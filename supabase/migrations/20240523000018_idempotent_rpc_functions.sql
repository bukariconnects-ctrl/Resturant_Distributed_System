-- Migration: Make RPC functions idempotent for offline sync support
-- This ensures that retrying operations doesn't cause errors or duplicate data

-- Update accept_delivery to be idempotent
CREATE OR REPLACE FUNCTION accept_delivery(
  p_order_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_delivery RECORD;
  v_restaurant RECORD;
  v_pickup_location TEXT;
  v_delivery_location TEXT;
BEGIN
  -- Lock the order row to prevent race conditions
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE NOWAIT;
  
  -- Check if order exists
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check if delivery already exists for this order
  SELECT * INTO v_delivery
  FROM public.deliveries
  WHERE order_id = p_order_id;
  
  -- IDEMPOTENT CHECK: If delivery exists and is assigned to this driver, return success
  IF v_delivery IS NOT NULL THEN
    IF v_delivery.driver_id = p_driver_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'delivery_id', v_delivery.id,
        'message', 'Delivery already assigned to you'
      );
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Delivery already assigned to another driver');
    END IF;
  END IF;
  
  -- Check if order is ready for delivery
  IF v_order.status != 'ready' THEN
    -- IDEMPOTENT: If order is already delivering by this driver, return success
    IF v_order.status = 'delivering' THEN
      SELECT * INTO v_delivery FROM public.deliveries WHERE order_id = p_order_id AND driver_id = p_driver_id;
      IF v_delivery IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'delivery_id', v_delivery.id, 'message', 'Already delivering');
      END IF;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Order is not ready for delivery');
  END IF;
  
  -- Get restaurant location for pickup
  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = v_order.restaurant_id;
  
  v_pickup_location := COALESCE(v_restaurant.location, 'موقع المطعم غير محدد');
  v_delivery_location := COALESCE(v_order.notes, 'عنوان التوصيل غير محدد');
  
  -- Create delivery record
  INSERT INTO public.deliveries (order_id, driver_id, status, pickup_location, delivery_location)
  VALUES (p_order_id, p_driver_id, 'assigned', v_pickup_location, v_delivery_location)
  RETURNING * INTO v_delivery;
  
  -- Update order status to delivering
  UPDATE public.orders
  SET status = 'delivering'
  WHERE id = p_order_id;
  
  -- Notify other drivers that order is taken
  PERFORM pg_notify(
    'delivery_requests',
    json_build_object(
      'event', 'order_taken',
      'order_id', p_order_id,
      'driver_id', p_driver_id
    )::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', v_delivery.id,
    'message', 'Delivery accepted successfully'
  );
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is being processed by another driver');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update complete_delivery to be idempotent
CREATE OR REPLACE FUNCTION complete_delivery(
  p_delivery_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_delivery RECORD;
  v_rows_affected INTEGER;
BEGIN
  -- Get and lock delivery
  SELECT * INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id AND driver_id = p_driver_id
  FOR UPDATE;
  
  IF v_delivery IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery not found or not assigned to you');
  END IF;
  
  -- IDEMPOTENT CHECK: If already delivered, return success
  IF v_delivery.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Delivery already completed');
  END IF;
  
  -- Update delivery status
  UPDATE public.deliveries
  SET status = 'delivered', delivered_at = NOW()
  WHERE id = p_delivery_id AND driver_id = p_driver_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to update delivery status');
  END IF;
  
  -- Update order status
  UPDATE public.orders
  SET status = 'delivered'
  WHERE id = v_delivery.order_id;
  
  -- Notify completion
  PERFORM pg_notify(
    'delivery_requests',
    json_build_object(
      'event', 'delivery_completed',
      'delivery_id', p_delivery_id,
      'order_id', v_delivery.order_id,
      'driver_id', p_driver_id
    )::text
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Delivery completed successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_order to be idempotent (using unique constraint on recent orders)
CREATE OR REPLACE FUNCTION create_order(
  p_restaurant_id UUID,
  p_total_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_order_id UUID;
  v_existing_order UUID;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get user role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  IF v_user_role != 'customer' THEN
    RAISE EXCEPTION 'Only customers can create orders';
  END IF;
  
  -- IDEMPOTENT CHECK: Check for duplicate order in last 30 seconds
  SELECT id INTO v_existing_order
  FROM public.orders
  WHERE customer_id = v_user_id
    AND restaurant_id = p_restaurant_id
    AND total_amount = p_total_amount
    AND COALESCE(notes, '') = COALESCE(p_notes, '')
    AND created_at > NOW() - INTERVAL '30 seconds'
    AND status = 'pending'
  LIMIT 1;
  
  IF v_existing_order IS NOT NULL THEN
    -- Return existing order ID (idempotent)
    RETURN v_existing_order;
  END IF;
  
  -- Create the order
  INSERT INTO public.orders (customer_id, restaurant_id, total_amount, notes, status)
  VALUES (v_user_id, p_restaurant_id, p_total_amount, p_notes, 'pending')
  RETURNING id INTO v_order_id;
  
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_delivery(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_delivery(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_order(UUID, NUMERIC, TEXT) TO authenticated;

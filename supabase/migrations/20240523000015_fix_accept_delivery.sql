-- ============================================
-- Fix accept_delivery function to include pickup_location and delivery_location
-- ============================================

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
  v_result JSONB;
BEGIN
  -- Lock the order row to prevent race conditions
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE NOWAIT;
  
  -- Check if order exists and is ready
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status != 'ready' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not ready for delivery or already taken');
  END IF;
  
  -- Check if delivery already exists for this order
  SELECT * INTO v_delivery
  FROM public.deliveries
  WHERE order_id = p_order_id;
  
  IF v_delivery IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery already assigned');
  END IF;
  
  -- Get restaurant location for pickup
  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = v_order.restaurant_id;
  
  IF v_restaurant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurant not found');
  END IF;
  
  -- Set pickup location from restaurant
  v_pickup_location := COALESCE(v_restaurant.location, 'موقع المطعم غير محدد');
  
  -- Set delivery location from order notes or default
  -- In a real app, this would come from customer address
  v_delivery_location := COALESCE(v_order.notes, 'عنوان التوصيل غير محدد');
  
  -- Create delivery record with locations
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

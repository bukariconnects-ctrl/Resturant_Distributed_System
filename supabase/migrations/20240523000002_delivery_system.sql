-- ============================================
-- Delivery System - Multicast Notifications
-- ============================================

-- Add driver location tracking (optional enhancement)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_location TEXT,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- Create index for available drivers
CREATE INDEX IF NOT EXISTS idx_profiles_available_drivers 
ON public.profiles(role, is_available) 
WHERE role = 'driver' AND is_available = true;

-- ============================================
-- Function: Notify drivers when order is ready
-- ============================================
CREATE OR REPLACE FUNCTION notify_drivers_order_ready()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'ready'
  IF NEW.status = 'ready' AND OLD.status != 'ready' THEN
    -- Send notification to all available drivers via pg_notify
    PERFORM pg_notify(
      'delivery_requests',
      json_build_object(
        'event', 'order_ready_for_delivery',
        'order_id', NEW.id,
        'restaurant_id', NEW.restaurant_id,
        'customer_id', NEW.customer_id,
        'total_amount', NEW.total_amount,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger: Order ready for delivery
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_drivers_order_ready ON public.orders;
CREATE TRIGGER trigger_notify_drivers_order_ready
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_drivers_order_ready();

-- ============================================
-- Function: Handle delivery acceptance (Race Condition)
-- ============================================
CREATE OR REPLACE FUNCTION accept_delivery(
  p_order_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_delivery RECORD;
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
  
  -- Create delivery record
  INSERT INTO public.deliveries (order_id, driver_id, status)
  VALUES (p_order_id, p_driver_id, 'assigned')
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

-- ============================================
-- RLS Policies for deliveries table updates
-- ============================================

-- Drop existing policies if any conflicts
DROP POLICY IF EXISTS "Drivers can update their deliveries" ON public.deliveries;

-- Drivers can update only their assigned deliveries
CREATE POLICY "Drivers can update their deliveries"
  ON public.deliveries
  FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- ============================================
-- Function: Complete delivery
-- ============================================
CREATE OR REPLACE FUNCTION complete_delivery(
  p_delivery_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_delivery RECORD;
BEGIN
  -- Get and lock delivery
  SELECT * INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id AND driver_id = p_driver_id
  FOR UPDATE;
  
  IF v_delivery IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery not found or not assigned to you');
  END IF;
  
  IF v_delivery.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery already completed');
  END IF;
  
  -- Update delivery status
  UPDATE public.deliveries
  SET status = 'delivered', delivered_at = NOW()
  WHERE id = p_delivery_id;
  
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Realtime for deliveries already enabled in initial migration
-- ============================================

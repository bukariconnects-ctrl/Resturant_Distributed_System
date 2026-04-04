-- ============================================
-- Fix complete_delivery function
-- Add missing delivered_at and picked_up_at columns
-- ============================================

-- Add missing columns to deliveries table
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

-- Recreate complete_delivery function with better error handling
CREATE OR REPLACE FUNCTION complete_delivery(
  p_delivery_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_delivery RECORD;
  v_rows_affected INTEGER;
BEGIN
  -- Get delivery without RLS (SECURITY DEFINER bypasses it)
  SELECT * INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id AND driver_id = p_driver_id
  FOR UPDATE;
  
  IF v_delivery IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Delivery not found or not assigned to you',
      'delivery_id', p_delivery_id,
      'driver_id', p_driver_id
    );
  END IF;
  
  IF v_delivery.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery already completed');
  END IF;
  
  -- Update delivery status
  UPDATE public.deliveries
  SET status = 'delivered', 
      delivered_at = NOW(),
      updated_at = NOW()
  WHERE id = p_delivery_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to update delivery status');
  END IF;
  
  -- Update order status (SECURITY DEFINER allows this)
  UPDATE public.orders
  SET status = 'delivered',
      updated_at = NOW()
  WHERE id = v_delivery.order_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to update order status');
  END IF;
  
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
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Delivery completed successfully',
    'order_id', v_delivery.order_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.complete_delivery(UUID, UUID) TO authenticated;

-- ============================================
-- Order Notifications - Event-Driven Architecture
-- ============================================

-- Create order_logs table for tracking order events
CREATE TABLE IF NOT EXISTS public.order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled')),
  old_status TEXT,
  new_status TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_order_logs_order_id ON public.order_logs(order_id);
CREATE INDEX idx_order_logs_event_type ON public.order_logs(event_type);
CREATE INDEX idx_order_logs_created_at ON public.order_logs(created_at DESC);

-- Enable RLS on order_logs
ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_logs

-- Customers can view logs for their orders
CREATE POLICY "Customers can view their order logs"
  ON public.order_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND customer_id = auth.uid()
    )
  );

-- Restaurant owners can view logs for their orders
CREATE POLICY "Restaurant owners can view their order logs"
  ON public.order_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.restaurants r ON o.restaurant_id = r.id
      WHERE o.id = order_id AND r.owner_id = auth.uid()
    )
  );

-- System can insert logs (via trigger)
CREATE POLICY "System can insert order logs"
  ON public.order_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Trigger Function: Log order creation
-- ============================================
CREATE OR REPLACE FUNCTION log_order_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.order_logs (order_id, event_type, old_status, new_status, metadata)
  VALUES (
    NEW.id,
    'created',
    NULL,
    NEW.status,
    jsonb_build_object(
      'customer_id', NEW.customer_id,
      'restaurant_id', NEW.restaurant_id,
      'total_amount', NEW.total_amount
    )
  );
  
  -- Notify via Realtime (pg_notify)
  PERFORM pg_notify(
    'order_events',
    json_build_object(
      'event', 'order_created',
      'order_id', NEW.id,
      'restaurant_id', NEW.restaurant_id,
      'customer_id', NEW.customer_id,
      'status', NEW.status,
      'total_amount', NEW.total_amount,
      'created_at', NEW.created_at
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger Function: Log order status changes
-- ============================================
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_logs (order_id, event_type, old_status, new_status, metadata)
    VALUES (
      NEW.id,
      NEW.status,
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'changed_at', NOW()
      )
    );
    
    -- Notify via Realtime (pg_notify)
    PERFORM pg_notify(
      'order_events',
      json_build_object(
        'event', 'order_status_changed',
        'order_id', NEW.id,
        'restaurant_id', NEW.restaurant_id,
        'customer_id', NEW.customer_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_at', NEW.updated_at
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create Triggers
-- ============================================

-- Trigger for new orders
CREATE TRIGGER trigger_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_created();

-- Trigger for order status changes
CREATE TRIGGER trigger_order_status_changed
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- ============================================
-- Enable Realtime for order_logs
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_logs;

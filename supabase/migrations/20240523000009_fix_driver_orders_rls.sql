-- ============================================
-- Fix Driver Orders RLS - Allow drivers to see ready orders
-- ============================================

-- Create a security definer function to check if user is a driver
CREATE OR REPLACE FUNCTION public.is_driver(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = user_uuid AND role = 'driver'
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_driver(UUID) TO authenticated;

-- Add policy for drivers to view ready orders
CREATE POLICY "Drivers can view ready orders"
  ON public.orders
  FOR SELECT
  USING (
    status = 'ready' AND public.is_driver(auth.uid())
  );

-- Also allow drivers to view orders they are delivering (status = 'delivering')
CREATE POLICY "Drivers can view delivering orders"
  ON public.orders
  FOR SELECT
  USING (
    status = 'delivering' AND 
    EXISTS (
      SELECT 1 FROM public.deliveries
      WHERE order_id = orders.id AND driver_id = auth.uid()
    )
  );

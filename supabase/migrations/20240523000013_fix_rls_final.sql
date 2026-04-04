-- ============================================
-- Final RLS Fix for All Tables
-- ============================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "orders_select_customer" ON public.orders;
DROP POLICY IF EXISTS "orders_select_restaurant" ON public.orders;
DROP POLICY IF EXISTS "orders_select_ready_drivers" ON public.orders;
DROP POLICY IF EXISTS "orders_select_delivering_driver" ON public.orders;

-- ============================================
-- Orders SELECT Policies - Simplified
-- ============================================

-- 1. Customers can view their own orders
CREATE POLICY "orders_select_customer"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

-- 2. Restaurant owners can view orders for their restaurant
-- Using subquery that doesn't cause recursion
CREATE POLICY "orders_select_restaurant"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

-- 3. Drivers can view orders with status 'ready' (no role check to avoid recursion)
CREATE POLICY "orders_select_ready_drivers"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (status = 'ready');

-- 4. Drivers can view orders they are delivering
CREATE POLICY "orders_select_delivering_driver"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    status IN ('delivering', 'delivered') AND
    id IN (
      SELECT order_id FROM public.deliveries WHERE driver_id = auth.uid()
    )
  );

-- ============================================
-- Profiles SELECT Policy - Allow reading customer info for orders
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow reading customer profiles for orders (restaurants and drivers need this)
CREATE POLICY "profiles_select_for_orders"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT customer_id FROM public.orders 
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    )
    OR
    user_id IN (
      SELECT customer_id FROM public.orders 
      WHERE id IN (SELECT order_id FROM public.deliveries WHERE driver_id = auth.uid())
    )
    OR
    user_id IN (
      SELECT customer_id FROM public.orders WHERE status = 'ready'
    )
  );

-- ============================================
-- Restaurants SELECT Policy
-- ============================================

-- Drop and recreate
DROP POLICY IF EXISTS "restaurants_select_all" ON public.restaurants;

-- Anyone authenticated can view restaurants
CREATE POLICY "restaurants_select_all"
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- Deliveries Policies
-- ============================================

DROP POLICY IF EXISTS "deliveries_select_driver" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_available" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_customer" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_restaurant" ON public.deliveries;

-- Drivers can view their deliveries
CREATE POLICY "deliveries_select_driver"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Drivers can view available deliveries (unassigned)
CREATE POLICY "deliveries_select_available"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (driver_id IS NULL);

-- Customers can view deliveries for their orders
CREATE POLICY "deliveries_select_customer"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
  );

-- Restaurant owners can view deliveries for their orders
CREATE POLICY "deliveries_select_restaurant"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    )
  );

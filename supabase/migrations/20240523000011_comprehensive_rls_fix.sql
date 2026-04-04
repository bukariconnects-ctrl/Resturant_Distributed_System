-- ============================================
-- Comprehensive RLS Fix for Order Lifecycle
-- ============================================
-- This migration fixes all RLS policies to ensure:
-- 1. Customers can only see/create their own orders
-- 2. Restaurants can only see/update orders for their restaurant
-- 3. Drivers can see orders with status 'ready' for pickup

-- ============================================
-- Helper Functions (Security Definer)
-- ============================================

-- Check if user is a customer
CREATE OR REPLACE FUNCTION public.is_customer(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = user_uuid AND role = 'customer'
  );
$$;

-- Check if user is a restaurant owner
CREATE OR REPLACE FUNCTION public.is_restaurant_owner(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = user_uuid AND role = 'restaurant'
  );
$$;

-- Check if user is a driver
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

-- Check if user owns a specific restaurant
CREATE OR REPLACE FUNCTION public.owns_restaurant(user_uuid UUID, rest_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = rest_id AND owner_id = user_uuid
  );
$$;

-- Get restaurant ID for a restaurant owner
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(user_uuid UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.restaurants
  WHERE owner_id = user_uuid
  LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_restaurant_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_restaurant_id(UUID) TO authenticated;

-- ============================================
-- Drop ALL existing policies on orders
-- ============================================
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can update pending orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can view ready orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can view delivering orders" ON public.orders;
DROP POLICY IF EXISTS "Service role full access" ON public.orders;

-- ============================================
-- Orders Policies - Recreate All
-- ============================================

-- 1. Customers can view their own orders only
CREATE POLICY "orders_select_customer"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

-- 2. Restaurant owners can view orders for their restaurant
CREATE POLICY "orders_select_restaurant"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- 3. Drivers can view orders with status 'ready' (available for pickup)
CREATE POLICY "orders_select_ready_drivers"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (status = 'ready' AND public.is_driver(auth.uid()));

-- 4. Drivers can view orders they are delivering
CREATE POLICY "orders_select_delivering_driver"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    status IN ('delivering', 'delivered') AND
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.order_id = orders.id AND d.driver_id = auth.uid()
    )
  );

-- 5. Customers can create orders (INSERT)
CREATE POLICY "orders_insert_customer"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id AND
    public.is_customer(auth.uid())
  );

-- 6. Customers can update their pending orders only
CREATE POLICY "orders_update_customer_pending"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id AND status = 'pending')
  WITH CHECK (auth.uid() = customer_id);

-- 7. Restaurant owners can update orders for their restaurant
CREATE POLICY "orders_update_restaurant"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- 8. Drivers can update orders they are delivering (via deliveries)
CREATE POLICY "orders_update_driver"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.order_id = orders.id AND d.driver_id = auth.uid()
    )
  );

-- ============================================
-- Drop ALL existing policies on profiles
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- ============================================
-- Profiles Policies - Recreate All
-- ============================================

-- 1. Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Users can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Service role can do anything (for seeding)
CREATE POLICY "profiles_service_role"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Drop ALL existing policies on deliveries
-- ============================================
DROP POLICY IF EXISTS "Drivers can view assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Customers can view their deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Restaurant owners can view deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Service role can insert deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON public.deliveries;

-- ============================================
-- Deliveries Policies - Recreate All
-- ============================================

-- 1. Drivers can view their assigned deliveries
CREATE POLICY "deliveries_select_driver"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- 2. Drivers can view available deliveries (unassigned)
CREATE POLICY "deliveries_select_available"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (driver_id IS NULL AND public.is_driver(auth.uid()));

-- 3. Customers can view deliveries for their orders
CREATE POLICY "deliveries_select_customer"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

-- 4. Restaurant owners can view deliveries for their orders
CREATE POLICY "deliveries_select_restaurant"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND public.owns_restaurant(auth.uid(), o.restaurant_id)
    )
  );

-- 5. Drivers can insert deliveries (accept orders)
CREATE POLICY "deliveries_insert_driver"
  ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = auth.uid() AND
    public.is_driver(auth.uid())
  );

-- 6. Drivers can update their assigned deliveries
CREATE POLICY "deliveries_update_driver"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- 7. Service role can do anything
CREATE POLICY "deliveries_service_role"
  ON public.deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Restaurants Policies - Fix
-- ============================================
DROP POLICY IF EXISTS "Anyone can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurant owners can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurant owners can update own restaurants" ON public.restaurants;

-- 1. Anyone authenticated can view restaurants
CREATE POLICY "restaurants_select_all"
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Restaurant owners can insert their restaurants
CREATE POLICY "restaurants_insert_owner"
  ON public.restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id AND
    public.is_restaurant_owner(auth.uid())
  );

-- 3. Restaurant owners can update their own restaurants
CREATE POLICY "restaurants_update_owner"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 4. Service role can do anything
CREATE POLICY "restaurants_service_role"
  ON public.restaurants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Grant necessary permissions
-- ============================================
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.deliveries TO authenticated;
GRANT ALL ON public.restaurants TO authenticated;
GRANT ALL ON public.order_logs TO authenticated;

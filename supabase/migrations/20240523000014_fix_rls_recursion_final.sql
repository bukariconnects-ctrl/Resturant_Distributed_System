-- ============================================
-- Fix RLS Recursion - Use SECURITY DEFINER functions
-- ============================================

-- Drop ALL existing policies on orders to start fresh
DROP POLICY IF EXISTS "orders_select_customer" ON public.orders;
DROP POLICY IF EXISTS "orders_select_restaurant" ON public.orders;
DROP POLICY IF EXISTS "orders_select_ready_drivers" ON public.orders;
DROP POLICY IF EXISTS "orders_select_delivering_driver" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_customer" ON public.orders;
DROP POLICY IF EXISTS "orders_update_restaurant" ON public.orders;
DROP POLICY IF EXISTS "orders_update_driver" ON public.orders;
DROP POLICY IF EXISTS "Customers can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can update orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can view ready orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurants can view their orders" ON public.orders;

-- Drop ALL profiles policies
DROP POLICY IF EXISTS "profiles_select_for_orders" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;

-- ============================================
-- SECURITY DEFINER Helper Functions (bypass RLS)
-- ============================================

-- Get restaurant IDs owned by a user
CREATE OR REPLACE FUNCTION public.get_user_restaurant_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM restaurants WHERE owner_id = user_uuid;
$$;

-- Get order IDs for a driver's deliveries
CREATE OR REPLACE FUNCTION public.get_driver_order_ids(driver_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT order_id FROM deliveries WHERE driver_id = driver_uuid;
$$;

-- Check if user owns a restaurant
CREATE OR REPLACE FUNCTION public.user_owns_restaurant(user_uuid UUID, rest_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM restaurants WHERE id = rest_id AND owner_id = user_uuid);
$$;

-- ============================================
-- Profiles Policies - Simple, no recursion
-- ============================================

-- Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow service role full access (for triggers)
CREATE POLICY "profiles_service_role"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Orders Policies - Using SECURITY DEFINER functions
-- ============================================

-- 1. Customers can view their own orders (simple, no recursion)
CREATE POLICY "orders_select_customer"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

-- 2. Restaurant owners can view their orders (using function)
CREATE POLICY "orders_select_restaurant"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (restaurant_id IN (SELECT public.get_user_restaurant_ids(auth.uid())));

-- 3. Drivers can view ready orders (simple status check, no role check)
CREATE POLICY "orders_select_ready"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (status = 'ready');

-- 4. Drivers can view orders they are delivering (using function)
CREATE POLICY "orders_select_delivering"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_driver_order_ids(auth.uid())));

-- 5. Customers can create orders (simple check)
CREATE POLICY "orders_insert_customer"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

-- 6. Restaurant owners can update their orders
CREATE POLICY "orders_update_restaurant"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (restaurant_id IN (SELECT public.get_user_restaurant_ids(auth.uid())))
  WITH CHECK (restaurant_id IN (SELECT public.get_user_restaurant_ids(auth.uid())));

-- 7. Drivers can update orders they are delivering
CREATE POLICY "orders_update_driver"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (id IN (SELECT public.get_driver_order_ids(auth.uid())))
  WITH CHECK (id IN (SELECT public.get_driver_order_ids(auth.uid())));

-- ============================================
-- Grant execute on functions
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_user_restaurant_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_order_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_restaurant(UUID, UUID) TO authenticated;

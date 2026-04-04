-- ============================================
-- Fix Orders RLS Infinite Recursion
-- ============================================
-- The issue: RLS policies on orders table use EXISTS subqueries
-- that check profiles table, which also has RLS policies.
-- This causes infinite recursion.
-- Solution: Use security definer functions to bypass RLS in checks.

-- Create a security definer function to check if user is a customer
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

-- Create a security definer function to check if user is a restaurant owner
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

-- Create a security definer function to check if user owns the restaurant
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

-- Drop existing orders policies
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can update pending orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can update their orders" ON public.orders;

-- Recreate policies using security definer functions

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Restaurant owners can view orders for their restaurants
CREATE POLICY "Restaurant owners can view their orders"
  ON public.orders
  FOR SELECT
  USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- Customers can create orders (simplified - no recursive check)
CREATE POLICY "Customers can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id AND
    public.is_customer(auth.uid())
  );

-- Customers can update their pending orders
CREATE POLICY "Customers can update pending orders"
  ON public.orders
  FOR UPDATE
  USING (auth.uid() = customer_id AND status = 'pending')
  WITH CHECK (auth.uid() = customer_id);

-- Restaurant owners can update orders for their restaurants
CREATE POLICY "Restaurant owners can update their orders"
  ON public.orders
  FOR UPDATE
  USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- Also fix restaurants INSERT policy
DROP POLICY IF EXISTS "Restaurant owners can insert restaurants" ON public.restaurants;

CREATE POLICY "Restaurant owners can insert restaurants"
  ON public.restaurants
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id AND
    public.is_restaurant_owner(auth.uid())
  );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.is_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_restaurant_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(UUID, UUID) TO authenticated;

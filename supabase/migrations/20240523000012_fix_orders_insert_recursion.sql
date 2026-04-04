-- ============================================
-- Fix Orders INSERT Infinite Recursion
-- ============================================
-- The is_customer() function causes recursion because profiles table has RLS.
-- Solution: Simplify INSERT policy to only check customer_id matches auth.uid()
-- The role check will be done at application level or trust the user.

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "orders_insert_customer" ON public.orders;

-- Create a simpler INSERT policy that doesn't cause recursion
-- We only check that the customer_id matches the authenticated user
-- The application should verify the user role before allowing order creation
CREATE POLICY "orders_insert_customer"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

-- Alternative: Create a SECURITY DEFINER function for inserting orders
-- This bypasses RLS entirely for the insert operation
CREATE OR REPLACE FUNCTION public.create_order(
  p_restaurant_id UUID,
  p_total_amount DECIMAL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_order_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Check user role (bypasses RLS)
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  IF v_user_role IS NULL OR v_user_role != 'customer' THEN
    RAISE EXCEPTION 'Only customers can create orders';
  END IF;
  
  -- Insert the order
  INSERT INTO public.orders (customer_id, restaurant_id, total_amount, notes, status)
  VALUES (v_user_id, p_restaurant_id, p_total_amount, p_notes, 'pending')
  RETURNING id INTO v_order_id;
  
  RETURN v_order_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_order(UUID, DECIMAL, TEXT) TO authenticated;

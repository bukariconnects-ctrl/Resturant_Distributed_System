-- ============================================
-- Fix Profile Insert Policy
-- ============================================
-- The issue is that when a user signs up, they need to insert their profile
-- but the RLS policy requires auth.uid() = user_id which may not be available
-- immediately after signup.

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create a more permissive insert policy that allows authenticated users
-- to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also allow service role to insert profiles (for seeding)
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

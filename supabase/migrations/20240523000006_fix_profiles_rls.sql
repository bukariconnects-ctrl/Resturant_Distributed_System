-- ============================================
-- Fix Profiles RLS Policies
-- ============================================
-- The issue: "Database error querying schema" happens because
-- the current RLS policy only allows users to see their own profile
-- but we need to query the profile right after login.

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create a more permissive SELECT policy
-- Users can view their own profile (authenticated users only)
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Also ensure the INSERT policy works correctly
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

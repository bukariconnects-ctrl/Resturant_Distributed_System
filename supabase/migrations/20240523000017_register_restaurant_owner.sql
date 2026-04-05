-- ============================================
-- Multi-step Restaurant Owner Registration
-- Atomic transaction for creating user profile + restaurant
-- ============================================

-- Function to register restaurant owner with restaurant in one transaction
-- Note: This function is called AFTER the auth user is created via supabase.auth.signUp
-- It creates the profile and restaurant atomically
CREATE OR REPLACE FUNCTION register_restaurant_owner(
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_restaurant_name TEXT,
  p_restaurant_location TEXT,
  p_restaurant_status TEXT DEFAULT 'open'
)
RETURNS JSONB AS $$
DECLARE
  v_profile_id UUID;
  v_restaurant_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF p_restaurant_name IS NULL OR p_restaurant_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurant name is required');
  END IF;
  
  IF p_restaurant_location IS NULL OR p_restaurant_location = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurant location is required');
  END IF;

  -- Check if profile already exists
  SELECT user_id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_profile_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile already exists for this user');
  END IF;

  -- Create profile for restaurant owner
  INSERT INTO public.profiles (user_id, full_name, phone, role)
  VALUES (p_user_id, p_full_name, p_phone, 'restaurant')
  RETURNING user_id INTO v_profile_id;
  
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create profile';
  END IF;

  -- Create restaurant linked to this owner
  INSERT INTO public.restaurants (name, location, status, owner_id)
  VALUES (p_restaurant_name, p_restaurant_location, p_restaurant_status, p_user_id)
  RETURNING id INTO v_restaurant_id;
  
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create restaurant';
  END IF;

  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Restaurant owner registered successfully',
    'profile_id', v_profile_id,
    'restaurant_id', v_restaurant_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will automatically rollback
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.register_restaurant_owner(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

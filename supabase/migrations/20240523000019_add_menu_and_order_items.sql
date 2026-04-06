-- Migration: Add Menu Items and Order Items tables for Restaurant Menu System
-- Also adds delivery_address column to orders table

-- ============================================
-- 1. Create menu_items table
-- ============================================
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  category TEXT DEFAULT 'عام',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by restaurant
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(restaurant_id, is_available);

-- ============================================
-- 2. Create order_items table
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_time_of_order NUMERIC(10, 2) NOT NULL CHECK (price_at_time_of_order >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by order
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ============================================
-- 3. Add delivery_address column to orders table
-- ============================================
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- ============================================
-- 4. RLS Policies for menu_items
-- ============================================

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Everyone can SELECT menu items (for browsing)
CREATE POLICY "Anyone can view menu items"
  ON public.menu_items
  FOR SELECT
  USING (true);

-- Restaurant owners can INSERT their own menu items
CREATE POLICY "Restaurant owners can insert menu items"
  ON public.menu_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = restaurant_id AND owner_id = auth.uid()
    )
  );

-- Restaurant owners can UPDATE their own menu items
CREATE POLICY "Restaurant owners can update menu items"
  ON public.menu_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = restaurant_id AND owner_id = auth.uid()
    )
  );

-- Restaurant owners can DELETE their own menu items
CREATE POLICY "Restaurant owners can delete menu items"
  ON public.menu_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = restaurant_id AND owner_id = auth.uid()
    )
  );

-- ============================================
-- 5. RLS Policies for order_items
-- ============================================

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Customers can view their own order items
CREATE POLICY "Customers can view their order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND customer_id = auth.uid()
    )
  );

-- Restaurant owners can view order items for their orders
CREATE POLICY "Restaurant owners can view order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.restaurants r ON o.restaurant_id = r.id
      WHERE o.id = order_id AND r.owner_id = auth.uid()
    )
  );

-- Drivers can view order items for their deliveries
CREATE POLICY "Drivers can view order items for their deliveries"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.orders o ON d.order_id = o.id
      WHERE o.id = order_id AND d.driver_id = auth.uid()
    )
  );

-- ============================================
-- 6. RPC Function for creating order with items (atomic)
-- ============================================
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_restaurant_id UUID,
  p_delivery_address TEXT,
  p_items JSONB -- Array of {menu_item_id, quantity}
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_order_id UUID;
  v_total_amount NUMERIC(10, 2) := 0;
  v_item JSONB;
  v_menu_item RECORD;
  v_item_total NUMERIC(10, 2);
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get user role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  IF v_user_role != 'customer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only customers can create orders');
  END IF;

  -- Validate delivery address
  IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery address is required');
  END IF;

  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order must contain at least one item');
  END IF;

  -- Calculate total and validate all items exist and are available
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_menu_item
    FROM public.menu_items
    WHERE id = (v_item->>'menu_item_id')::UUID
      AND restaurant_id = p_restaurant_id
      AND is_available = true;
    
    IF v_menu_item IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Menu item not found or not available: ' || (v_item->>'menu_item_id')
      );
    END IF;
    
    v_item_total := v_menu_item.price * (v_item->>'quantity')::INTEGER;
    v_total_amount := v_total_amount + v_item_total;
  END LOOP;

  -- IDEMPOTENCY CHECK: Check for duplicate order in last 30 seconds
  SELECT id INTO v_order_id
  FROM public.orders
  WHERE customer_id = v_user_id
    AND restaurant_id = p_restaurant_id
    AND total_amount = v_total_amount
    AND delivery_address = p_delivery_address
    AND created_at > NOW() - INTERVAL '30 seconds'
    AND status = 'pending'
  LIMIT 1;
  
  IF v_order_id IS NOT NULL THEN
    -- Return existing order (idempotent)
    RETURN jsonb_build_object(
      'success', true, 
      'order_id', v_order_id, 
      'total_amount', v_total_amount,
      'message', 'Order already exists'
    );
  END IF;

  -- Create the order
  INSERT INTO public.orders (customer_id, restaurant_id, total_amount, delivery_address, status)
  VALUES (v_user_id, p_restaurant_id, v_total_amount, p_delivery_address, 'pending')
  RETURNING id INTO v_order_id;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_menu_item
    FROM public.menu_items
    WHERE id = (v_item->>'menu_item_id')::UUID;
    
    INSERT INTO public.order_items (order_id, menu_item_id, quantity, price_at_time_of_order)
    VALUES (
      v_order_id,
      (v_item->>'menu_item_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      v_menu_item.price
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'order_id', v_order_id, 
    'total_amount', v_total_amount,
    'message', 'Order created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, TEXT, JSONB) TO authenticated;

-- ============================================
-- 7. Enable Realtime for menu_items and order_items
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

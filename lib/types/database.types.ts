export type UserRole = 'customer' | 'restaurant' | 'driver';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';

export type DeliveryStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered';

export type RestaurantStatus = 'open' | 'closed' | 'busy';

export interface Profile {
  user_id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  location: string;
  status: RestaurantStatus;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  status: OrderStatus;
  total_amount: number;
  items: any;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_id?: string;
  status: DeliveryStatus;
  pickup_location: string;
  delivery_location: string;
  location_data?: any;
  created_at: string;
  updated_at: string;
}

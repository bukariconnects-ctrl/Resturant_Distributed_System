'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface CartItem {
  id: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
  image_url?: string | null
}

interface CartContextType {
  items: CartItem[]
  restaurantId: string | null
  restaurantName: string | null
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>, quantity?: number) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
  setRestaurant: (id: string, name: string) => void
  totalItems: number
  totalPrice: number
  getItemQuantity: (menuItemId: string) => number
}

const CartContext = createContext<CartContextType>({
  items: [],
  restaurantId: null,
  restaurantName: null,
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  setRestaurant: () => {},
  totalItems: 0,
  totalPrice: 0,
  getItemQuantity: () => 0,
})

export function useCart() {
  return useContext(CartContext)
}

interface CartProviderProps {
  children: ReactNode
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)

  const setRestaurant = useCallback((id: string, name: string) => {
    // If switching restaurants, clear the cart
    if (restaurantId && restaurantId !== id) {
      setItems([])
    }
    setRestaurantId(id)
    setRestaurantName(name)
  }, [restaurantId])

  const addItem = useCallback((item: Omit<CartItem, 'id' | 'quantity'>, quantity: number = 1) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(i => i.menu_item_id === item.menu_item_id)
      
      if (existingIndex >= 0) {
        // Update quantity of existing item
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        }
        return updated
      }
      
      // Add new item
      return [...prev, {
        ...item,
        id: `cart-${item.menu_item_id}-${Date.now()}`,
        quantity,
      }]
    })
  }, [])

  const removeItem = useCallback((menuItemId: string) => {
    setItems(prev => prev.filter(item => item.menu_item_id !== menuItemId))
  }, [])

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId)
      return
    }
    
    setItems(prev => prev.map(item => 
      item.menu_item_id === menuItemId 
        ? { ...item, quantity } 
        : item
    ))
  }, [removeItem])

  const clearCart = useCallback(() => {
    setItems([])
    setRestaurantId(null)
    setRestaurantName(null)
  }, [])

  const getItemQuantity = useCallback((menuItemId: string) => {
    const item = items.find(i => i.menu_item_id === menuItemId)
    return item?.quantity || 0
  }, [items])

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  return (
    <CartContext.Provider value={{
      items,
      restaurantId,
      restaurantName,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      setRestaurant,
      totalItems,
      totalPrice,
      getItemQuantity,
    }}>
      {children}
    </CartContext.Provider>
  )
}

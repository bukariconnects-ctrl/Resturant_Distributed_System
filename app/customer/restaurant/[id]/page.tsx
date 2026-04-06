'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserNav } from '@/components/auth/UserNav'
import { useCart } from '@/components/providers/CartProvider'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Minus, ShoppingCart } from 'lucide-react'

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  is_available: boolean
  image_url: string | null
  category: string
}

interface Restaurant {
  id: string
  name: string
  location: string
  status: string
}

export default function CustomerRestaurantMenuPage() {
  const params = useParams()
  const router = useRouter()
  const restaurantId = params.id as string
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { 
    addItem, 
    removeItem, 
    updateQuantity, 
    getItemQuantity, 
    totalItems, 
    totalPrice,
    setRestaurant: setCartRestaurant,
    restaurantId: cartRestaurantId,
  } = useCart()

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      // Load restaurant info
      const { data: restData, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, location, status')
        .eq('id', restaurantId)
        .single()

      if (restError || !restData) {
        setError('لم يتم العثور على المطعم')
        setLoading(false)
        return
      }

      setRestaurant(restData)
      setCartRestaurant(restData.id, restData.name)

      // Load menu items
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true)
        .order('category')
        .order('name')

      if (menuError) {
        console.error('Error loading menu:', menuError)
        setError('حدث خطأ في تحميل القائمة')
      } else {
        setMenuItems(menuData || [])
      }

      setLoading(false)
    }

    if (restaurantId) {
      loadData()
    }
  }, [restaurantId, setCartRestaurant])

  const handleAddToCart = (item: MenuItem) => {
    addItem({
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      image_url: item.image_url,
    })
    toast.success(`تمت إضافة ${item.name} إلى السلة`)
  }

  const handleUpdateQuantity = (item: MenuItem, delta: number) => {
    const currentQty = getItemQuantity(item.id)
    const newQty = currentQty + delta
    
    if (newQty <= 0) {
      removeItem(item.id)
    } else {
      updateQuantity(item.id, newQty)
    }
  }

  // Group items by category
  const groupedItems = menuItems.reduce((acc, item) => {
    const cat = item.category || 'عام'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, MenuItem[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل القائمة...</p>
        </div>
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-blue-50 p-8">
        <Alert variant="destructive">
          <AlertDescription>{error || 'حدث خطأ'}</AlertDescription>
        </Alert>
        <Link href="/customer" className="text-blue-600 hover:underline mt-4 block">
          ← العودة للصفحة الرئيسية
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/customer" className="text-blue-600 hover:underline">
              ← العودة
            </Link>
            <div>
              <h1 className="text-xl font-bold text-blue-600">{restaurant.name}</h1>
              <p className="text-sm text-gray-500">{restaurant.location}</p>
            </div>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 pb-32">
        {menuItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p className="text-lg">لا توجد عناصر متاحة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => {
                    const quantity = getItemQuantity(item.id)
                    
                    return (
                      <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        {item.image_url && (
                          <div className="h-40 bg-gray-100 overflow-hidden">
                            <img 
                              src={item.image_url} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-lg">{item.name}</h3>
                            <span className="text-lg font-bold text-blue-600">
                              {item.price.toFixed(2)} ريال
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-500 mb-4">{item.description}</p>
                          )}
                          
                          <div className="flex items-center justify-between mt-4">
                            {quantity > 0 ? (
                              <div className="flex items-center gap-3 bg-blue-50 rounded-full px-2 py-1">
                                <button
                                  onClick={() => handleUpdateQuantity(item, -1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow hover:bg-gray-50"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="font-semibold text-lg min-w-[24px] text-center">
                                  {quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(item, 1)}
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                onClick={() => handleAddToCart(item)}
                                className="w-full"
                              >
                                <Plus className="w-4 h-4 ml-2" />
                                أضف للسلة
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Cart Summary */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-20">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">{totalItems} عنصر</p>
                <p className="text-lg font-bold text-blue-600">{totalPrice.toFixed(2)} ريال</p>
              </div>
            </div>
            <Button 
              size="lg"
              onClick={() => router.push('/customer/checkout')}
              className="px-8"
            >
              إتمام الطلب
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

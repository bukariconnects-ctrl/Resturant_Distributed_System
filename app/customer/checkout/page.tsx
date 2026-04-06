'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserNav } from '@/components/auth/UserNav'
import { useCart } from '@/components/providers/CartProvider'
import Link from 'next/link'
import { toast } from 'sonner'
import { Trash2, MapPin } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const { 
    items, 
    restaurantId, 
    restaurantName, 
    totalPrice, 
    clearCart,
    updateQuantity,
    removeItem,
  } = useCart()
  
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!deliveryAddress.trim()) {
      setError('يرجى إدخال عنوان التوصيل')
      return
    }

    if (!restaurantId || items.length === 0) {
      setError('السلة فارغة')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Prepare items for RPC
      const orderItems = items.map(item => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
      }))

      // Call atomic RPC function
      const { data, error: rpcError } = await supabase.rpc('create_order_with_items', {
        p_restaurant_id: restaurantId,
        p_delivery_address: deliveryAddress.trim(),
        p_items: orderItems,
      })

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        setError('حدث خطأ في إنشاء الطلب')
        setLoading(false)
        return
      }

      if (!data.success) {
        setError(data.error || 'حدث خطأ في إنشاء الطلب')
        setLoading(false)
        return
      }

      toast.success('تم إنشاء الطلب بنجاح!')
      clearCart()
      router.push(`/customer/orders/${data.order_id}`)

    } catch (err) {
      console.error('Error:', err)
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-blue-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/customer" className="text-blue-600 hover:underline">
              ← العودة
            </Link>
            <UserNav />
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg text-gray-500 mb-4">السلة فارغة</p>
              <Link href="/customer">
                <Button>تصفح المطاعم</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href={`/customer/restaurant/${restaurantId}`} className="text-blue-600 hover:underline">
              ← العودة للقائمة
            </Link>
            <h1 className="text-xl font-bold text-blue-600">إتمام الطلب</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>ملخص الطلب</CardTitle>
              <p className="text-sm text-gray-500">{restaurantName}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.price.toFixed(2)} ريال × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">
                      {(item.price * item.quantity).toFixed(2)} ريال
                    </span>
                    <button
                      onClick={() => removeItem(item.menu_item_id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>الإجمالي</span>
                  <span className="text-blue-600">{totalPrice.toFixed(2)} ريال</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                عنوان التوصيل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitOrder} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="address">العنوان الكامل *</Label>
                  <Input
                    id="address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="مثال: شارع الملك فهد، حي النزهة، مبنى رقم 5"
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500">
                    يرجى إدخال العنوان بالتفصيل لضمان وصول الطلب
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? 'جاري إرسال الطلب...' : `تأكيد الطلب (${totalPrice.toFixed(2)} ريال)`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

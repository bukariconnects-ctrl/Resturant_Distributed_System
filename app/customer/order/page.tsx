'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserNav } from '@/components/auth/UserNav'
import { resilientRpc } from '@/lib/resilient-api'
import { toast } from 'sonner'

interface Restaurant {
  id: string
  name: string
  location: string
  status: string
}

export default function CustomerOrderPage() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)

  useEffect(() => {
    async function loadRestaurants() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, location, status')
        .eq('status', 'open')
        .order('name')

      if (error) {
        console.error('Error loading restaurants:', error)
        setError('حدث خطأ في تحميل المطاعم')
      } else {
        setRestaurants(data || [])
      }
      setLoadingRestaurants(false)
    }

    loadRestaurants()
  }, [])

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (!selectedRestaurant) {
      setError('يرجى اختيار مطعم')
      setLoading(false)
      return
    }

    const amount = parseFloat(totalAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('يرجى إدخال مبلغ صحيح')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('يجب تسجيل الدخول أولاً')
        router.push('/login')
        return
      }

      // Use resilient RPC call with offline support
      const { data: orderId, error: orderError, queued } = await resilientRpc<string>({
        functionName: 'create_order',
        payload: {
          p_restaurant_id: selectedRestaurant,
          p_total_amount: amount,
          p_notes: notes || null,
        },
      })

      // If queued for later sync
      if (queued) {
        toast.info('📱 تم حفظ الطلب للمزامنة', {
          description: 'سيتم إرسال طلبك تلقائياً عند استعادة الاتصال',
          duration: 5000,
        })
        setSuccess('تم حفظ الطلب! سيتم إرساله عند استعادة الاتصال.')
        setTimeout(() => router.push('/customer'), 2000)
        return
      }

      if (orderError) {
        console.error('Order creation error:', orderError)
        if (orderError.message.includes('Only customers can create orders')) {
          setError('ليس لديك صلاحية لإنشاء طلب. تأكد من أن حسابك من نوع "عميل"')
        } else if (orderError.message.includes('User not authenticated')) {
          setError('يجب تسجيل الدخول أولاً')
          router.push('/login')
        } else {
          setError('حدث خطأ في إنشاء الطلب: ' + orderError.message)
        }
        return
      }

      setSuccess('تم إنشاء الطلب بنجاح! جاري تحويلك لصفحة التتبع...')
      
      setTimeout(() => {
        router.push(`/customer/orders/${orderId}`)
      }, 1500)

    } catch (err) {
      setError('حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/customer" className="text-blue-600 hover:underline">
              ← العودة
            </Link>
            <h1 className="text-xl font-bold text-blue-600">إنشاء طلب جديد</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>طلب جديد</CardTitle>
            <CardDescription>
              اختر المطعم وأدخل تفاصيل طلبك
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmitOrder}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="restaurant">اختر المطعم</Label>
                {loadingRestaurants ? (
                  <div className="h-10 bg-gray-100 animate-pulse rounded"></div>
                ) : restaurants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    لا توجد مطاعم متاحة حالياً
                  </p>
                ) : (
                  <Select
                    value={selectedRestaurant}
                    onValueChange={setSelectedRestaurant}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر مطعم" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map((restaurant) => (
                        <SelectItem key={restaurant.id} value={restaurant.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{restaurant.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {restaurant.location}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ الإجمالي (ريال)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                  disabled={loading}
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="أي ملاحظات إضافية..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || loadingRestaurants || restaurants.length === 0}
              >
                {loading ? 'جاري إرسال الطلب...' : 'إرسال الطلب'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  )
}

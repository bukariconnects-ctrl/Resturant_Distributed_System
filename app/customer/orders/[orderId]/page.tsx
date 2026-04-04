'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserNav } from '@/components/auth/UserNav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'

interface Order {
  id: string
  status: OrderStatus
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
  restaurant: {
    id: string
    name: string
    location: string
  }
}

const ORDER_STATUSES: { key: OrderStatus; label: string; icon: string }[] = [
  { key: 'pending', label: 'قيد الانتظار', icon: '⏳' },
  { key: 'confirmed', label: 'تم التأكيد', icon: '✅' },
  { key: 'preparing', label: 'جاري التحضير', icon: '👨‍🍳' },
  { key: 'ready', label: 'جاهز للتوصيل', icon: '📦' },
  { key: 'delivering', label: 'جاري التوصيل', icon: '🚗' },
  { key: 'delivered', label: 'تم التوصيل', icon: '🎉' },
]

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  pending: 'طلبك قيد الانتظار، سيتم تأكيده قريباً',
  confirmed: 'تم تأكيد طلبك! المطعم يستعد للتحضير',
  preparing: 'المطعم يحضر طلبك الآن 👨‍🍳',
  ready: 'طلبك جاهز! في انتظار السائق 📦',
  delivering: 'السائق في الطريق إليك 🚗',
  delivered: 'تم توصيل طلبك بنجاح! شكراً لك 🎉',
  cancelled: 'تم إلغاء الطلب',
}

function getStatusIndex(status: OrderStatus): number {
  const index = ORDER_STATUSES.findIndex(s => s.key === status)
  return index === -1 ? 0 : index
}

function OrderStepper({ currentStatus }: { currentStatus: OrderStatus }) {
  const currentIndex = getStatusIndex(currentStatus)
  const isCancelled = currentStatus === 'cancelled'

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center p-8 bg-red-50 rounded-xl border border-red-200">
        <div className="text-center">
          <span className="text-4xl mb-2 block">❌</span>
          <span className="text-red-600 font-medium">تم إلغاء الطلب</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Progress Line */}
      <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200 mx-8 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-700 ease-out"
          style={{ width: `${(currentIndex / (ORDER_STATUSES.length - 1)) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="relative flex justify-between">
        {ORDER_STATUSES.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isPending = index > currentIndex

          return (
            <div key={step.key} className="flex flex-col items-center z-10">
              {/* Circle */}
              <div 
                className={`
                  w-16 h-16 rounded-full flex items-center justify-center text-2xl
                  transition-all duration-500 transform
                  ${isCompleted 
                    ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg shadow-green-200 scale-100' 
                    : isCurrent 
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-200 scale-110 animate-pulse' 
                      : 'bg-gray-100 text-gray-400 scale-90'
                  }
                `}
              >
                {isCompleted ? '✓' : step.icon}
              </div>

              {/* Label */}
              <span 
                className={`
                  mt-3 text-xs font-medium text-center max-w-[80px] transition-colors duration-300
                  ${isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'}
                `}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OrderTrackingPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrder = useCallback(async () => {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_amount,
        notes,
        created_at,
        updated_at,
        restaurant:restaurants(id, name, location)
      `)
      .eq('id', orderId)
      .eq('customer_id', user.id)
      .single()

    if (fetchError) {
      console.error('Error fetching order:', fetchError)
      setError('لم يتم العثور على الطلب أو ليس لديك صلاحية لعرضه')
      setLoading(false)
      return
    }

    setOrder(data as unknown as Order)
    setLoading(false)
  }, [orderId, router])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  // Realtime subscription for order updates
  useEffect(() => {
    if (!orderId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as OrderStatus
          const oldStatus = order?.status

          // Update order state
          setOrder(prev => prev ? { ...prev, ...payload.new } as Order : null)

          // Show toast notification if status changed
          if (oldStatus && newStatus !== oldStatus) {
            const statusInfo = ORDER_STATUSES.find(s => s.key === newStatus)
            toast.success(
              `${statusInfo?.icon || '📋'} ${STATUS_MESSAGES[newStatus]}`,
              {
                duration: 5000,
                description: `حالة الطلب: ${statusInfo?.label || newStatus}`,
              }
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId, order?.status])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل تفاصيل الطلب...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/customer" className="text-blue-600 hover:underline">
              ← العودة للرئيسية
            </Link>
            <UserNav />
          </div>
        </header>
        <main className="max-w-2xl mx-auto p-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <span className="text-4xl mb-4 block">❌</span>
              <p className="text-red-600 font-medium">{error || 'حدث خطأ غير متوقع'}</p>
              <Link href="/customer">
                <Button className="mt-4" variant="outline">
                  العودة للرئيسية
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const currentStatusInfo = ORDER_STATUSES.find(s => s.key === order.status)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/customer" className="text-blue-600 hover:underline">
              ← العودة
            </Link>
            <h1 className="text-xl font-bold text-blue-600">تتبع الطلب</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Order ID Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">رقم الطلب</CardTitle>
              <span className="text-xs text-gray-500">
                {new Date(order.created_at).toLocaleDateString('ar-SA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <code className="text-lg font-mono bg-gray-100 px-3 py-1 rounded">
              #{order.id.slice(0, 8).toUpperCase()}
            </code>
          </CardContent>
        </Card>

        {/* Status Message */}
        <Card className={`
          border-0 shadow-lg transition-all duration-500
          ${order.status === 'delivered' 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
            : order.status === 'cancelled'
              ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
          }
        `}>
          <CardContent className="p-6 text-center">
            <span className="text-4xl mb-3 block">{currentStatusInfo?.icon || '📋'}</span>
            <p className="text-xl font-medium">{STATUS_MESSAGES[order.status]}</p>
          </CardContent>
        </Card>

        {/* Stepper */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg text-center">مراحل الطلب</CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            <OrderStepper currentStatus={order.status} />
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">تفاصيل الطلب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">المطعم</span>
              <span className="font-medium">{order.restaurant?.name || 'غير محدد'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">الموقع</span>
              <span className="font-medium">{order.restaurant?.location || 'غير محدد'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">المبلغ الإجمالي</span>
              <span className="font-bold text-lg text-green-600">
                {order.total_amount.toFixed(2)} ريال
              </span>
            </div>
            {order.notes && (
              <div className="py-2">
                <span className="text-gray-600 block mb-1">ملاحظات</span>
                <p className="bg-gray-50 p-3 rounded-lg text-gray-700">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Link href="/customer">
            <Button variant="outline" className="px-8">
              العودة للرئيسية
            </Button>
          </Link>
          <Link href="/customer/orders">
            <Button className="px-8 bg-blue-600 hover:bg-blue-700">
              جميع طلباتي
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}

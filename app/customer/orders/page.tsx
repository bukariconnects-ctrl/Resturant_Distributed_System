'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserNav } from '@/components/auth/UserNav'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled'

interface Order {
  id: string
  status: OrderStatus
  total_amount: number
  created_at: string
  restaurant: {
    name: string
  }
}

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  confirmed: { label: 'تم التأكيد', color: 'bg-blue-100 text-blue-800', icon: '✅' },
  preparing: { label: 'جاري التحضير', color: 'bg-orange-100 text-orange-800', icon: '👨‍🍳' },
  ready: { label: 'جاهز', color: 'bg-purple-100 text-purple-800', icon: '📦' },
  delivering: { label: 'جاري التوصيل', color: 'bg-indigo-100 text-indigo-800', icon: '🚗' },
  delivered: { label: 'تم التوصيل', color: 'bg-green-100 text-green-800', icon: '🎉' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800', icon: '❌' },
}

export default function CustomerOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          created_at,
          restaurant:restaurants(name)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching orders:', error)
      } else {
        setOrders(data as unknown as Order[])
      }
      setLoading(false)
    }

    fetchOrders()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/customer" className="text-blue-600 hover:underline">
              ← العودة
            </Link>
            <h1 className="text-xl font-bold text-blue-600">طلباتي</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تحميل الطلبات...</p>
          </div>
        ) : orders.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <span className="text-6xl mb-4 block">📋</span>
              <h2 className="text-xl font-medium text-gray-700 mb-2">لا توجد طلبات</h2>
              <p className="text-gray-500 mb-6">لم تقم بإنشاء أي طلبات بعد</p>
              <Link href="/customer/order">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  إنشاء طلب جديد
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status]
              return (
                <Link key={order.id} href={`/customer/orders/${order.id}`}>
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                              #{order.id.slice(0, 8).toUpperCase()}
                            </code>
                            <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.color}`}>
                              {statusInfo.icon} {statusInfo.label}
                            </span>
                          </div>
                          <p className="font-medium text-gray-800">
                            {order.restaurant?.name || 'مطعم غير محدد'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(order.created_at).toLocaleDateString('ar-SA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-lg text-green-600">
                            {order.total_amount.toFixed(2)} ريال
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            عرض التفاصيل ←
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

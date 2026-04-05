'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserNav } from '@/components/auth/UserNav'
import Link from 'next/link'

interface Order {
  id: string
  customer_id: string
  restaurant_id: string
  status: string
  total_amount: number
  notes: string | null
  created_at: string
  customer?: {
    full_name: string
    phone: string
  }
}

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  ready: 'جاهز للتوصيل',
  delivering: 'قيد التوصيل',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  preparing: 'bg-orange-100 text-orange-800 border-orange-200',
  ready: 'bg-green-100 text-green-800 border-green-200',
  delivering: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}

export default function RestaurantDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  const loadOrders = useCallback(async (restId: string, supabase: ReturnType<typeof createClient>) => {
    // Log session for debugging
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Session check in loadOrders:', session ? 'Active' : 'No session')

    const { data, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:profiles!orders_customer_id_fkey(full_name, phone)
      `)
      .eq('restaurant_id', restId)
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Error loading orders:', ordersError)
      setError('حدث خطأ في تحميل الطلبات')
    } else {
      setOrders(data || [])
    }
  }, [])

  useEffect(() => {
    // Create single supabase client instance for this effect
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function initialize() {
      // Log session for debugging
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session check in initialize:', session ? 'Active' : 'No session')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('يجب تسجيل الدخول')
        setLoading(false)
        return
      }

      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (restError || !restaurant) {
        console.error('Restaurant fetch error:', restError)
        setError('لم يتم العثور على مطعم مرتبط بحسابك. يرجى إنشاء مطعم أولاً.')
        setLoading(false)
        return
      }

      setRestaurantId(restaurant.id)
      await loadOrders(restaurant.id, supabase)
      setLoading(false)

      // Realtime subscription for all order events (INSERT, UPDATE, DELETE)
      channel = supabase
        .channel(`restaurant-orders-${restaurant.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restaurant.id}`,
          },
          async (payload) => {
            console.log('Order change received:', payload.eventType, payload)
            
            if (payload.eventType === 'INSERT') {
              // Fetch the new order with customer data
              const { data: newOrder } = await supabase
                .from('orders')
                .select(`*, customer:profiles!orders_customer_id_fkey(full_name, phone)`)
                .eq('id', payload.new.id)
                .single()
              
              if (newOrder) {
                setOrders(prev => [newOrder, ...prev])
              }
            } else if (payload.eventType === 'UPDATE') {
              // Update the order in state immediately
              setOrders(prev => prev.map(order => 
                order.id === payload.new.id 
                  ? { ...order, ...payload.new }
                  : order
              ))
            } else if (payload.eventType === 'DELETE') {
              // Remove the order from state
              setOrders(prev => prev.filter(order => order.id !== payload.old.id))
            }
          }
        )
        .subscribe((status) => {
          console.log('Restaurant channel status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Restaurant realtime connected')
          }
        })
    }

    initialize()

    // Cleanup function to unsubscribe
    return () => {
      if (channel) {
        console.log('Unsubscribing from restaurant channel')
        supabase.removeChannel(channel)
      }
    }
  }, [loadOrders])

  const handleAcceptOrder = async (orderId: string) => {
    setUpdatingOrder(orderId)
    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error accepting order:', updateError)
      setError('حدث خطأ في قبول الطلب')
    }

    setUpdatingOrder(null)
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrder(orderId)
    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order:', updateError)
      setError('حدث خطأ في تحديث حالة الطلب')
      setUpdatingOrder(null)
      return
    }

    // If status changed to 'ready', broadcast to all drivers (Multicast)
    if (newStatus === 'ready') {
      const order = orders.find(o => o.id === orderId)
      await supabase
        .channel('available_drivers')
        .send({
          type: 'broadcast',
          event: 'new_order_ready',
          payload: {
            order_id: orderId,
            restaurant_id: restaurantId,
            total_amount: order?.total_amount,
            customer_name: order?.customer?.full_name,
          },
        })
    }

    setUpdatingOrder(null)
  }

  const getNextStatus = (currentStatus: string): string | null => {
    const statusFlow: Record<string, string> = {
      confirmed: 'preparing',
      preparing: 'ready',
    }
    return statusFlow[currentStatus] || null
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const activeOrders = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status))
  const completedOrders = orders.filter(o => ['delivering', 'delivered', 'cancelled'].includes(o.status))

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/restaurant" className="text-green-600 hover:underline">
              ← العودة
            </Link>
            <h1 className="text-xl font-bold text-green-600">لوحة التحكم</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">جاري تحميل الطلبات...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Orders */}
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
                طلبات جديدة ({pendingOrders.length})
              </h2>

              {pendingOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    لا توجد طلبات جديدة حالياً
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pendingOrders.map((order) => (
                    <Card key={order.id} className="border-yellow-200 bg-yellow-50">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">
                            طلب #{order.id.slice(0, 8)}
                          </CardTitle>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                        </div>
                        <CardDescription>
                          {formatDate(order.created_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">العميل:</p>
                          <p className="font-medium">{order.customer?.full_name || 'غير معروف'}</p>
                          <p className="text-sm text-gray-500">{order.customer?.phone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">المبلغ:</p>
                          <p className="font-bold text-lg">{order.total_amount} ريال</p>
                        </div>
                        {order.notes && (
                          <div>
                            <p className="text-sm text-gray-600">ملاحظات:</p>
                            <p className="text-sm">{order.notes}</p>
                          </div>
                        )}
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => handleAcceptOrder(order.id)}
                          disabled={updatingOrder === order.id}
                        >
                          {updatingOrder === order.id ? 'جاري القبول...' : 'قبول الطلب'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Active Orders */}
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                طلبات قيد التنفيذ ({activeOrders.length})
              </h2>

              {activeOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    لا توجد طلبات قيد التنفيذ
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeOrders.map((order) => (
                    <Card key={order.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">
                            طلب #{order.id.slice(0, 8)}
                          </CardTitle>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                        </div>
                        <CardDescription>
                          {formatDate(order.created_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">العميل:</p>
                          <p className="font-medium">{order.customer?.full_name || 'غير معروف'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">المبلغ:</p>
                          <p className="font-bold">{order.total_amount} ريال</p>
                        </div>
                        {getNextStatus(order.status) && (
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => handleUpdateStatus(order.id, getNextStatus(order.status)!)}
                            disabled={updatingOrder === order.id}
                          >
                            {updatingOrder === order.id
                              ? 'جاري التحديث...'
                              : `تحديث إلى: ${statusLabels[getNextStatus(order.status)!]}`
                            }
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Completed Orders */}
            {completedOrders.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  طلبات مكتملة ({completedOrders.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedOrders.slice(0, 6).map((order) => (
                    <Card key={order.id} className="opacity-75">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">
                            طلب #{order.id.slice(0, 8)}
                          </CardTitle>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                        </div>
                        <CardDescription>
                          {formatDate(order.created_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="font-bold">{order.total_amount} ريال</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

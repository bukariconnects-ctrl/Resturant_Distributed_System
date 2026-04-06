'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserNav } from '@/components/auth/UserNav'
import Link from 'next/link'
import { resilientRpc } from '@/lib/resilient-api'
import { toast } from 'sonner'

interface Order {
  id: string
  customer_id: string
  restaurant_id: string
  status: string
  total_amount: number
  notes: string | null
  created_at: string
  restaurant?: {
    name: string
    location: string
  }
  customer?: {
    full_name: string
    phone: string
  }
}

interface Delivery {
  id: string
  order_id: string
  driver_id: string
  status: string
  picked_up_at: string | null
  delivered_at: string | null
  order?: Order
}

const statusLabels: Record<string, string> = {
  ready: 'جاهز للتوصيل',
  delivering: 'قيد التوصيل',
  delivered: 'تم التوصيل',
  assigned: 'تم التعيين',
  picked_up: 'تم الاستلام',
}

const statusColors: Record<string, string> = {
  ready: 'bg-green-100 text-green-800 border-green-200',
  delivering: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-gray-100 text-gray-800 border-gray-200',
  assigned: 'bg-blue-100 text-blue-800 border-blue-200',
  picked_up: 'bg-orange-100 text-orange-800 border-orange-200',
}

export default function DriverDashboard() {
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [acceptingOrder, setAcceptingOrder] = useState<string | null>(null)
  const [completingDelivery, setCompletingDelivery] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const loadAvailableOrders = useCallback(async (supabase: ReturnType<typeof createClient>) => {
    // Log session for debugging
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Session check in loadAvailableOrders:', session ? 'Active' : 'No session')

    const { data, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant:restaurants(name, location),
        customer:profiles!orders_customer_id_fkey(full_name, phone)
      `)
      .eq('status', 'ready')
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('Error loading orders:', ordersError)
    } else {
      // Deduplicate by ID using Map
      const uniqueOrders = Array.from(
        new Map((data || []).map(o => [o.id, o])).values()
      )
      setAvailableOrders(uniqueOrders)
    }
  }, [])

  const loadMyDeliveries = useCallback(async (driverId: string, supabase: ReturnType<typeof createClient>) => {
    const { data, error: deliveriesError } = await supabase
      .from('deliveries')
      .select(`
        *,
        order:orders(
          *,
          restaurant:restaurants(name, location),
          customer:profiles!orders_customer_id_fkey(full_name, phone)
        )
      `)
      .eq('driver_id', driverId)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false })

    if (deliveriesError) {
      console.error('Error loading deliveries:', deliveriesError)
    } else {
      // Deduplicate by ID using Map
      const uniqueDeliveries = Array.from(
        new Map((data || []).map(d => [d.id, d])).values()
      )
      setMyDeliveries(uniqueDeliveries)
    }
  }, [])

  useEffect(() => {
    // Create single supabase client instance for this effect
    const supabase = createClient()
    let availableDriversChannel: ReturnType<typeof supabase.channel> | null = null
    let ordersChannel: ReturnType<typeof supabase.channel> | null = null
    let deliveriesChannel: ReturnType<typeof supabase.channel> | null = null

    async function initialize() {
      // Log session for debugging
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session check in driver initialize:', session ? 'Active' : 'No session')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('يجب تسجيل الدخول')
        setLoading(false)
        return
      }

      setUserId(user.id)
      await loadAvailableOrders(supabase)
      await loadMyDeliveries(user.id, supabase)
      setLoading(false)

      // Subscribe to available_drivers channel for multicast notifications
      availableDriversChannel = supabase
        .channel('available_drivers')
        .on('broadcast', { event: 'new_order_ready' }, async (payload) => {
          console.log('New order ready for delivery:', payload)
          setNotification('🔔 طلب جديد جاهز للتوصيل!')
          // Fetch the new order with full data
          const { data: newOrder } = await supabase
            .from('orders')
            .select(`*, restaurant:restaurants(name, location), customer:profiles!orders_customer_id_fkey(full_name, phone)`)
            .eq('id', payload.payload.order_id)
            .single()
          if (newOrder) {
            setAvailableOrders(prev => {
              if (prev.find(o => o.id === newOrder.id)) return prev
              return [newOrder, ...prev]
            })
          }
          setTimeout(() => setNotification(null), 5000)
        })
        .on('broadcast', { event: 'order_taken' }, (payload) => {
          console.log('Order taken by another driver:', payload)
          // Immediately remove from UI
          setAvailableOrders(prev => prev.filter(o => o.id !== payload.payload.order_id))
        })
        .subscribe((status) => {
          console.log('Available drivers channel status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Driver multicast channel connected')
          }
        })

      // Subscribe to orders table changes for all events
      ordersChannel = supabase
        .channel('driver-orders-ready')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          async (payload) => {
            console.log('Order change received:', payload.eventType, payload)
            const newOrder = payload.new as Order
            const oldOrder = payload.old as Order
            
            if (payload.eventType === 'UPDATE') {
              // Order became ready - add to available
              if (newOrder?.status === 'ready' && oldOrder?.status !== 'ready') {
                const { data: fullOrder } = await supabase
                  .from('orders')
                  .select(`*, restaurant:restaurants(name, location), customer:profiles!orders_customer_id_fkey(full_name, phone)`)
                  .eq('id', newOrder.id)
                  .single()
                if (fullOrder) {
                  setAvailableOrders(prev => {
                    if (prev.find(o => o.id === fullOrder.id)) return prev
                    return [fullOrder, ...prev]
                  })
                  setNotification('🔔 طلب جديد جاهز للتوصيل!')
                  setTimeout(() => setNotification(null), 5000)
                }
              }
              // Order no longer ready - remove from available
              if (newOrder?.status !== 'ready' && oldOrder?.status === 'ready') {
                setAvailableOrders(prev => prev.filter(o => o.id !== newOrder.id))
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('Orders channel status:', status)
        })

      // Subscribe to my deliveries changes
      deliveriesChannel = supabase
        .channel(`driver-deliveries-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `driver_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('Delivery change received:', payload.eventType, payload)
            
            if (payload.eventType === 'INSERT') {
              // New delivery assigned - fetch with full order data
              const { data: newDelivery } = await supabase
                .from('deliveries')
                .select(`*, order:orders(*, restaurant:restaurants(name, location), customer:profiles!orders_customer_id_fkey(full_name, phone))`)
                .eq('id', payload.new.id)
                .single()
              if (newDelivery) {
                // Deduplicate: only add if not already in state
                setMyDeliveries(prev => {
                  if (prev.some(d => d.id === newDelivery.id)) return prev
                  return [newDelivery, ...prev]
                })
              }
            } else if (payload.eventType === 'UPDATE') {
              const newStatus = (payload.new as Delivery).status
              if (newStatus === 'delivered') {
                // Remove from active deliveries
                setMyDeliveries(prev => prev.filter(d => d.id !== payload.new.id))
              } else {
                // Update delivery in state
                setMyDeliveries(prev => prev.map(d => 
                  d.id === payload.new.id ? { ...d, ...payload.new } : d
                ))
              }
            } else if (payload.eventType === 'DELETE') {
              setMyDeliveries(prev => prev.filter(d => d.id !== payload.old.id))
            }
          }
        )
        .subscribe((status) => {
          console.log('Deliveries channel status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Driver deliveries channel connected')
          }
        })
    }

    initialize()

    // Cleanup function to unsubscribe from all channels
    return () => {
      console.log('Cleaning up driver dashboard channels')
      if (availableDriversChannel) supabase.removeChannel(availableDriversChannel)
      if (ordersChannel) supabase.removeChannel(ordersChannel)
      if (deliveriesChannel) supabase.removeChannel(deliveriesChannel)
    }
  }, [loadAvailableOrders, loadMyDeliveries])

  const handleAcceptOrder = async (orderId: string) => {
    if (!userId) return

    setAcceptingOrder(orderId)
    setError(null)

    try {
      const supabase = createClient()

      // Use resilient RPC call with offline support
      const { data, error: rpcError, queued } = await resilientRpc<{ success: boolean; error?: string }>({
        functionName: 'accept_delivery',
        payload: {
          p_order_id: orderId,
          p_driver_id: userId,
        },
      })

      if (queued) {
        toast.info('📱 تم حفظ الطلب للمزامنة', {
          description: 'سيتم قبول التوصيل عند استعادة الاتصال',
        })
        // Optimistically update UI
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId))
        setNotification('📱 تم حفظ الطلب - سيتم المزامنة لاحقاً')
        setTimeout(() => setNotification(null), 3000)
        return
      }

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        setError('حدث خطأ في قبول الطلب')
        return
      }

      if (!data?.success) {
        setError(data?.error || 'لم يتم قبول الطلب')
        // Refresh available orders
        await loadAvailableOrders(supabase)
        return
      }

      // Broadcast to other drivers that order is taken
      await supabase
        .channel('available_drivers')
        .send({
          type: 'broadcast',
          event: 'order_taken',
          payload: { order_id: orderId, driver_id: userId },
        })

      // Refresh lists
      await loadAvailableOrders(supabase)
      await loadMyDeliveries(userId, supabase)

      setNotification('✅ تم قبول الطلب بنجاح!')
      setTimeout(() => setNotification(null), 3000)

    } catch (err) {
      console.error('Error accepting order:', err)
      setError('حدث خطأ في الاتصال')
    } finally {
      setAcceptingOrder(null)
    }
  }

  const handleCompleteDelivery = async (deliveryId: string) => {
    if (!userId) return

    setCompletingDelivery(deliveryId)
    setError(null)

    try {
      const supabase = createClient()

      // Use resilient RPC call with offline support
      const { data, error: rpcError, queued } = await resilientRpc<{ success: boolean; error?: string }>({
        functionName: 'complete_delivery',
        payload: {
          p_delivery_id: deliveryId,
          p_driver_id: userId,
        },
      })

      if (queued) {
        toast.info('📱 تم حفظ التوصيل للمزامنة', {
          description: 'سيتم تأكيد التوصيل عند استعادة الاتصال',
        })
        // Optimistically update UI
        setMyDeliveries(prev => prev.filter(d => d.id !== deliveryId))
        setNotification('📱 تم حفظ التوصيل - سيتم المزامنة لاحقاً')
        setTimeout(() => setNotification(null), 3000)
        return
      }

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        setError('حدث خطأ في إكمال التوصيل')
        return
      }

      if (!data?.success) {
        setError(data?.error || 'لم يتم إكمال التوصيل')
        return
      }

      await loadMyDeliveries(userId, supabase)
      setNotification('✅ تم إكمال التوصيل بنجاح!')
      setTimeout(() => setNotification(null), 3000)

    } catch (err) {
      console.error('Error completing delivery:', err)
      setError('حدث خطأ في الاتصال')
    } finally {
      setCompletingDelivery(null)
    }
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

  return (
    <div className="min-h-screen bg-purple-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/driver" className="text-purple-600 hover:underline">
              ← العودة
            </Link>
            <h1 className="text-xl font-bold text-purple-600">لوحة تحكم السائق</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        {/* Notification Banner */}
        {notification && (
          <Alert className="mb-6 bg-green-50 text-green-800 border-green-200 animate-pulse">
            <AlertDescription className="text-lg font-medium">
              {notification}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">جاري تحميل الطلبات...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* My Active Deliveries */}
            {myDeliveries.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                  توصيلاتي النشطة ({myDeliveries.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {myDeliveries.map((delivery) => (
                    <Card key={delivery.id} className="border-purple-200 bg-purple-50">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">
                            طلب #{delivery.order_id.slice(0, 8)}
                          </CardTitle>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[delivery.status]}`}>
                            {statusLabels[delivery.status]}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">المطعم:</p>
                          <p className="font-medium">{delivery.order?.restaurant?.name}</p>
                          <p className="text-sm text-gray-500">{delivery.order?.restaurant?.location}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">العميل:</p>
                          <p className="font-medium">{delivery.order?.customer?.full_name}</p>
                          <p className="text-sm text-gray-500">{delivery.order?.customer?.phone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">المبلغ:</p>
                          <p className="font-bold text-lg">{delivery.order?.total_amount} ريال</p>
                        </div>
                        {delivery.status !== 'delivered' && (
                          <Button
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => handleCompleteDelivery(delivery.id)}
                            disabled={completingDelivery === delivery.id}
                          >
                            {completingDelivery === delivery.id
                              ? 'جاري الإكمال...'
                              : '✓ تم التوصيل'
                            }
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Available Orders */}
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                طلبات جاهزة للتوصيل ({availableOrders.length})
              </h2>

              {availableOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="text-6xl mb-4">🚗</div>
                    <p className="text-gray-500 text-lg">لا توجد طلبات جاهزة للتوصيل حالياً</p>
                    <p className="text-gray-400 text-sm mt-2">سيتم إشعارك فور توفر طلبات جديدة</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableOrders.map((order) => (
                    <Card key={order.id} className="border-green-200 bg-green-50 hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">
                            طلب #{order.id.slice(0, 8)}
                          </CardTitle>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors.ready}`}>
                            {statusLabels.ready}
                          </span>
                        </div>
                        <CardDescription>
                          {formatDate(order.created_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">المطعم:</p>
                          <p className="font-medium">{order.restaurant?.name}</p>
                          <p className="text-sm text-gray-500">{order.restaurant?.location}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">العميل:</p>
                          <p className="font-medium">{order.customer?.full_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">المبلغ:</p>
                          <p className="font-bold text-lg text-green-700">{order.total_amount} ريال</p>
                        </div>
                        {order.notes && (
                          <div>
                            <p className="text-sm text-gray-600">ملاحظات:</p>
                            <p className="text-sm">{order.notes}</p>
                          </div>
                        )}
                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          onClick={() => handleAcceptOrder(order.id)}
                          disabled={acceptingOrder === order.id}
                        >
                          {acceptingOrder === order.id
                            ? 'جاري القبول...'
                            : '🚗 قبول التوصيل'
                          }
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

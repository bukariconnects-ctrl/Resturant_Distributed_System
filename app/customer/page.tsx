'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserNav } from '@/components/auth/UserNav'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Store } from 'lucide-react'

interface Restaurant {
  id: string
  name: string
  location: string
  status: string
}

export default function CustomerPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRestaurants() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, location, status')
        .eq('status', 'open')
        .order('name')

      if (!error && data) {
        setRestaurants(data)
      }
      setLoading(false)
    }
    loadRestaurants()
  }, [])

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">واجهة العميل</h1>
          <UserNav />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">مرحباً بك!</h2>
          <p className="text-gray-600 mb-6">يمكنك طلب الطعام من المطاعم المتاحة</p>
          
          <div className="flex gap-4">
            <Link href="/customer/orders">
              <Button variant="outline">
                طلباتي السابقة
              </Button>
            </Link>
          </div>
        </div>

        {/* Restaurants List */}
        <h3 className="text-xl font-semibold text-gray-700 mb-4">المطاعم المتاحة</h3>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مطاعم متاحة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map((restaurant) => (
              <Link key={restaurant.id} href={`/customer/restaurant/${restaurant.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 p-3 rounded-full">
                        <Store className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-1">{restaurant.name}</h4>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {restaurant.location}
                        </p>
                        <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          مفتوح
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

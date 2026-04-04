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

interface Restaurant {
  id: string
  name: string
  location: string
  status: string
}

export default function RestaurantSetupPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    status: 'open',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    async function loadRestaurant() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (data) {
        setRestaurant(data)
        setFormData({
          name: data.name,
          location: data.location,
          status: data.status,
        })
      }

      setInitialLoading(false)
    }

    loadRestaurant()
  }, [router])

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('يجب تسجيل الدخول')
        return
      }

      if (restaurant) {
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({
            name: formData.name,
            location: formData.location,
            status: formData.status,
          })
          .eq('id', restaurant.id)

        if (updateError) {
          setError('حدث خطأ في تحديث بيانات المطعم')
          return
        }

        setSuccess('تم تحديث بيانات المطعم بنجاح')
      } else {
        const { data: newRestaurant, error: insertError } = await supabase
          .from('restaurants')
          .insert({
            name: formData.name,
            location: formData.location,
            status: formData.status,
            owner_id: user.id,
          })
          .select()
          .single()

        if (insertError) {
          if (insertError.message.includes('violates row-level security')) {
            setError('ليس لديك صلاحية لإنشاء مطعم. تأكد من أن حسابك من نوع "صاحب مطعم"')
          } else {
            setError('حدث خطأ في إنشاء المطعم: ' + insertError.message)
          }
          return
        }

        setRestaurant(newRestaurant)
        setSuccess('تم إنشاء المطعم بنجاح!')
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/restaurant" className="text-green-600 hover:underline">
              ← العودة
            </Link>
            <h1 className="text-xl font-bold text-green-600">إعدادات المطعم</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-8">
        {initialLoading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">جاري التحميل...</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {restaurant ? 'تعديل بيانات المطعم' : 'إنشاء مطعم جديد'}
              </CardTitle>
              <CardDescription>
                {restaurant 
                  ? 'قم بتحديث معلومات مطعمك'
                  : 'أدخل معلومات مطعمك للبدء في استقبال الطلبات'
                }
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
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
                  <Label htmlFor="name">اسم المطعم</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="أدخل اسم المطعم"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">الموقع / العنوان</Label>
                  <Input
                    id="location"
                    type="text"
                    placeholder="أدخل عنوان المطعم"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">حالة المطعم</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange('status', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">مفتوح</SelectItem>
                      <SelectItem value="closed">مغلق</SelectItem>
                      <SelectItem value="busy">مشغول</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  {loading 
                    ? 'جاري الحفظ...' 
                    : restaurant 
                      ? 'حفظ التغييرات' 
                      : 'إنشاء المطعم'
                  }
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </main>
    </div>
  )
}

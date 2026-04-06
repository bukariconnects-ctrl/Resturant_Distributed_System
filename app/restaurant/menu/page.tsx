'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserNav } from '@/components/auth/UserNav'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface MenuItem {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  price: number
  is_available: boolean
  image_url: string | null
  category: string
  created_at: string
}

interface MenuItemForm {
  name: string
  description: string
  price: string
  category: string
  image_url: string
}

const emptyForm: MenuItemForm = {
  name: '',
  description: '',
  price: '',
  category: 'عام',
  image_url: '',
}

export default function RestaurantMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<MenuItemForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadMenuItems = useCallback(async (restId: string, supabase: ReturnType<typeof createClient>) => {
    const { data, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restId)
      .order('category')
      .order('name')

    if (menuError) {
      console.error('Error loading menu:', menuError)
      setError('حدث خطأ في تحميل القائمة')
    } else {
      setMenuItems(data || [])
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function initialize() {
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
        setError('لم يتم العثور على مطعم مرتبط بحسابك')
        setLoading(false)
        return
      }

      setRestaurantId(restaurant.id)
      await loadMenuItems(restaurant.id, supabase)
      setLoading(false)
    }

    initialize()
  }, [loadMenuItems])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurantId) return

    setSaving(true)
    const supabase = createClient()

    const price = parseFloat(formData.price)
    if (isNaN(price) || price < 0) {
      toast.error('يرجى إدخال سعر صحيح')
      setSaving(false)
      return
    }

    const itemData = {
      restaurant_id: restaurantId,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price,
      category: formData.category.trim() || 'عام',
      image_url: formData.image_url.trim() || null,
    }

    if (editingId) {
      // Update existing item
      const { error: updateError } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', editingId)

      if (updateError) {
        toast.error('حدث خطأ في تحديث العنصر')
        console.error(updateError)
      } else {
        toast.success('تم تحديث العنصر بنجاح')
        setMenuItems(prev => prev.map(item => 
          item.id === editingId ? { ...item, ...itemData } : item
        ))
        resetForm()
      }
    } else {
      // Create new item
      const { data: newItem, error: insertError } = await supabase
        .from('menu_items')
        .insert(itemData)
        .select()
        .single()

      if (insertError) {
        toast.error('حدث خطأ في إضافة العنصر')
        console.error(insertError)
      } else {
        toast.success('تم إضافة العنصر بنجاح')
        setMenuItems(prev => [...prev, newItem])
        resetForm()
      }
    }

    setSaving(false)
  }

  const handleEdit = (item: MenuItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      image_url: item.image_url || '',
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId)

    if (deleteError) {
      toast.error('حدث خطأ في حذف العنصر')
      console.error(deleteError)
    } else {
      toast.success('تم حذف العنصر بنجاح')
      setMenuItems(prev => prev.filter(item => item.id !== itemId))
    }
  }

  const toggleAvailability = async (item: MenuItem) => {
    const supabase = createClient()
    const newAvailability = !item.is_available

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ is_available: newAvailability })
      .eq('id', item.id)

    if (updateError) {
      toast.error('حدث خطأ في تحديث الحالة')
      console.error(updateError)
    } else {
      setMenuItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, is_available: newAvailability } : i
      ))
      toast.success(newAvailability ? 'تم تفعيل العنصر' : 'تم إيقاف العنصر')
    }
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setEditingId(null)
    setShowForm(false)
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
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل القائمة...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-orange-50 p-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/restaurant/dashboard" className="text-orange-600 hover:underline">
              ← لوحة التحكم
            </Link>
            <h1 className="text-xl font-bold text-orange-600">إدارة القائمة</h1>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Add/Edit Form */}
        {showForm ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? 'تعديل عنصر' : 'إضافة عنصر جديد'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">اسم العنصر *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      placeholder="مثال: برجر لحم"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">السعر (ريال) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      required
                      placeholder="0.00"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">التصنيف</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="مثال: وجبات رئيسية"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image_url">رابط الصورة (اختياري)</Label>
                    <Input
                      id="image_url"
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://..."
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف (اختياري)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="وصف مختصر للعنصر..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'جاري الحفظ...' : editingId ? 'تحديث' : 'إضافة'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setShowForm(true)} className="mb-6">
            <Plus className="w-4 h-4 ml-2" />
            إضافة عنصر جديد
          </Button>
        )}

        {/* Menu Items List */}
        {menuItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <p className="text-lg mb-2">لا توجد عناصر في القائمة</p>
              <p className="text-sm">ابدأ بإضافة عناصر القائمة الخاصة بمطعمك</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <Card 
                      key={item.id} 
                      className={`transition-all ${!item.is_available ? 'opacity-60 bg-gray-50' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{item.name}</h3>
                            {item.description && (
                              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                            )}
                          </div>
                          <span className="text-lg font-bold text-orange-600">
                            {item.price.toFixed(2)} ريال
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4 pt-3 border-t">
                          <button
                            onClick={() => toggleAvailability(item)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                              item.is_available 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {item.is_available ? (
                              <>
                                <Check className="w-4 h-4" />
                                متاح
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4" />
                                غير متاح
                              </>
                            )}
                          </button>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

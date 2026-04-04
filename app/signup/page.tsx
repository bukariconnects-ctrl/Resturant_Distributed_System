'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { UserRole } from '@/lib/types/database.types'

const roleOptions = [
  { value: 'customer', label: 'عميل', icon: '👤', color: 'blue', description: 'لطلب الطعام من المطاعم' },
  { value: 'restaurant', label: 'صاحب مطعم', icon: '🍽️', color: 'green', description: 'لإدارة مطعمك وطلباته' },
  { value: 'driver', label: 'سائق توصيل', icon: '🚗', color: 'purple', description: 'لتوصيل الطلبات للعملاء' },
]

const roleDefaultPaths: Record<string, string> = {
  customer: '/customer',
  restaurant: '/restaurant/dashboard',
  driver: '/driver/dashboard',
}

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    role: '' as UserRole | '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError('كلمات المرور غير متطابقة')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      setLoading(false)
      return
    }

    if (!formData.role) {
      setError('يرجى اختيار نوع الحساب')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: formData.role,
          }
        }
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('هذا البريد الإلكتروني مسجل بالفعل')
        } else {
          setError(signUpError.message)
        }
        return
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            role: formData.role,
            full_name: formData.fullName,
            phone: formData.phone,
          })

        if (profileError) {
          console.error('Profile creation error:', profileError)
          setError('حدث خطأ في إنشاء الملف الشخصي')
          return
        }

        setSuccess('تم إنشاء الحساب بنجاح! جاري تحويلك...')
        
        setTimeout(() => {
          const redirectPath = roleDefaultPaths[formData.role] || '/login'
          router.push(redirectPath)
        }, 1500)
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 py-12">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-green-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">R</span>
            </div>
            <span className="text-white font-bold text-2xl">RDS</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">إنشاء حساب جديد</h1>
          <p className="text-white/60">انضم إلينا وابدأ رحلتك</p>
        </div>

        {/* Signup Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-500/20 border-red-500/50 text-red-200">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-500/20 border-green-500/50 text-green-200">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="text-white/80">نوع الحساب</Label>
              <div className="grid grid-cols-3 gap-2">
                {roleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('role', option.value)}
                    disabled={loading}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all disabled:opacity-50 ${
                      formData.role === option.value
                        ? option.color === 'blue'
                          ? 'bg-blue-500/30 border-blue-400 text-white'
                          : option.color === 'green'
                          ? 'bg-green-500/30 border-green-400 text-white'
                          : 'bg-purple-500/30 border-purple-400 text-white'
                        : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <span className="text-xs font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white/80">الاسم الكامل</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="أدخل اسمك الكامل"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                required
                disabled={loading}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white/80">رقم الهاتف</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="05xxxxxxxx"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
                disabled={loading}
                dir="ltr"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400"
              />
            </div>
            
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                disabled={loading}
                dir="ltr"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400"
              />
            </div>
            
            {/* Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  disabled={loading}
                  dir="ltr"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white/80">تأكيد كلمة المرور</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  required
                  disabled={loading}
                  dir="ltr"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 hover:opacity-90 text-white py-6 text-lg rounded-xl mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  جاري إنشاء الحساب...
                </span>
              ) : (
                'إنشاء الحساب'
              )}
            </Button>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center mt-6 text-white/60">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
            تسجيل الدخول
          </Link>
        </p>

        {/* Back to home */}
        <p className="text-center mt-4">
          <Link href="/" className="text-white/40 hover:text-white/60 text-sm">
            ← العودة للصفحة الرئيسية
          </Link>
        </p>
      </div>
    </div>
  )
}

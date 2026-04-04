'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const TEST_CREDENTIALS = {
  customer: { email: 'customer@example.com', password: '123456', label: '👤 عميل', color: 'blue' },
  restaurant: { email: 'restaurant@example.com', password: '123456', label: '🍽️ مطعم', color: 'green' },
  driver: { email: 'driver@example.com', password: '123456', label: '🚗 سائق', color: 'purple' },
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fillTestCredentials = (role: 'customer' | 'restaurant' | 'driver') => {
    setEmail(TEST_CREDENTIALS[role].email)
    setPassword(TEST_CREDENTIALS[role].password)
    setError(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('يرجى تأكيد بريدك الإلكتروني أولاً')
        } else {
          setError(signInError.message)
        }
        return
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', data.user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
          setError(profileError.message || 'خطأ في قراءة الملف الشخصي')
          return
        }
        
        if (!profile) {
          setError('لم يتم العثور على ملف المستخدم')
          return
        }

        // Redirect based on role
        switch (profile.role) {
          case 'customer':
            router.push('/customer')
            break
          case 'restaurant':
            router.push('/restaurant/dashboard')
            break
          case 'driver':
            router.push('/driver/dashboard')
            break
          default:
            router.push('/')
        }
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">R</span>
            </div>
            <span className="text-white font-bold text-2xl">RDS</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">مرحباً بعودتك</h1>
          <p className="text-white/60">سجل دخولك للوصول إلى حسابك</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="bg-red-500/20 border-red-500/50 text-red-200">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                dir="ltr"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                dir="ltr"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 hover:opacity-90 text-white py-6 text-lg rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  جاري تسجيل الدخول...
                </span>
              ) : (
                'تسجيل الدخول'
              )}
            </Button>

            {/* Test Credentials */}
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-white/40 mb-3 text-center">
                تعبئة سريعة للاختبار:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillTestCredentials('customer')}
                  disabled={loading}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-all text-white/80 hover:text-white disabled:opacity-50"
                >
                  <span className="text-xl">👤</span>
                  <span className="text-xs">عميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillTestCredentials('restaurant')}
                  disabled={loading}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-all text-white/80 hover:text-white disabled:opacity-50"
                >
                  <span className="text-xl">🍽️</span>
                  <span className="text-xs">مطعم</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillTestCredentials('driver')}
                  disabled={loading}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 transition-all text-white/80 hover:text-white disabled:opacity-50"
                >
                  <span className="text-xl">🚗</span>
                  <span className="text-xs">سائق</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Sign up link */}
        <p className="text-center mt-6 text-white/60">
          ليس لديك حساب؟{' '}
          <Link href="/signup" className="text-purple-400 hover:text-purple-300 font-medium">
            إنشاء حساب جديد
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

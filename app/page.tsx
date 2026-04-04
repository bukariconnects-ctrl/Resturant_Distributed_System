import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <span className="text-white font-bold text-xl hidden sm:block">RDS</span>
          </div>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                تسجيل الدخول
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-white text-slate-900 hover:bg-gray-100">
                إنشاء حساب
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative min-h-screen flex items-center justify-center px-4">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-white/80 text-sm">نظام موزع يعمل في الوقت الفعلي</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            نظام إدارة طلبات
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
              المطاعم الموزع
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
            منصة متكاملة تربط بين العملاء والمطاعم والسائقين في نظام موزع 
            يعتمد على معمارية Event-Driven مع تحديثات فورية في الوقت الفعلي
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 hover:opacity-90 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-purple-500/25">
                ابدأ الآن مجاناً
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl">
                تسجيل الدخول
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {/* Customer Feature */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">👤</span>
              </div>
              <h3 className="text-white font-semibold mb-2">للعملاء</h3>
              <p className="text-white/60 text-sm">اطلب طعامك المفضل وتتبع طلبك في الوقت الفعلي</p>
            </div>

            {/* Restaurant Feature */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">🍽️</span>
              </div>
              <h3 className="text-white font-semibold mb-2">للمطاعم</h3>
              <p className="text-white/60 text-sm">أدر طلباتك بكفاءة مع إشعارات فورية</p>
            </div>

            {/* Driver Feature */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">🚗</span>
              </div>
              <h3 className="text-white font-semibold mb-2">للسائقين</h3>
              <p className="text-white/60 text-sm">استقبل طلبات التوصيل فوراً عبر Multicast</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-6">
        <div className="text-center text-white/40 text-sm">
          <p>Restaurant Distributed System © 2026</p>
          <p className="mt-1">Built with Next.js, Supabase & Realtime</p>
        </div>
      </footer>
    </div>
  );
}

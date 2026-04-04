import Link from 'next/link'
import { UserNav } from '@/components/auth/UserNav'
import { Button } from '@/components/ui/button'

export default function RestaurantPage() {
  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-green-600">واجهة المطعم</h1>
          <UserNav />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">مرحباً بك!</h2>
          <p className="text-gray-600 mb-6">إدارة مطعمك والطلبات الواردة</p>
          
          <div className="flex gap-4">
            <Link href="/restaurant/dashboard">
              <Button className="bg-green-600 hover:bg-green-700">
                لوحة التحكم - الطلبات
              </Button>
            </Link>
            <Link href="/restaurant/setup">
              <Button variant="outline">
                إعدادات المطعم
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

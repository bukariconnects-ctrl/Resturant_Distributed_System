import Link from 'next/link'
import { UserNav } from '@/components/auth/UserNav'
import { Button } from '@/components/ui/button'

export default function DriverPage() {
  return (
    <div className="min-h-screen bg-purple-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-purple-600">واجهة السائق</h1>
          <UserNav />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">مرحباً بك!</h2>
          <p className="text-gray-600 mb-6">استقبل طلبات التوصيل وابدأ العمل</p>
          
          <div className="flex gap-4">
            <Link href="/driver/dashboard">
              <Button className="bg-purple-600 hover:bg-purple-700">
                🚗 لوحة التحكم - الطلبات
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

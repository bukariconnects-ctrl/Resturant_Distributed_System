import { NextResponse } from 'next/server'
import { seedTestUsers, deleteTestUsers } from '@/lib/supabase/seed-users'

export async function POST() {
  try {
    const result = await seedTestUsers()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Seed API error:', error)
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const result = await deleteTestUsers()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Delete API error:', error)
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}

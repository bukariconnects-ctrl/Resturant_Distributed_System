import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export interface TestUser {
  email: string
  password: string
  fullName: string
  phone: string
  role: 'customer' | 'restaurant' | 'driver'
}

export const TEST_USERS: TestUser[] = [
  {
    email: 'customer@example.com',
    password: '123456',
    fullName: 'عميل تجريبي',
    phone: '0501234567',
    role: 'customer',
  },
  {
    email: 'restaurant@example.com',
    password: '123456',
    fullName: 'صاحب مطعم تجريبي',
    phone: '0507654321',
    role: 'restaurant',
  },
  {
    email: 'driver@example.com',
    password: '123456',
    fullName: 'سائق تجريبي',
    phone: '0509876543',
    role: 'driver',
  },
]

export const TEST_RESTAURANT = {
  name: 'مطعم الاختبار',
  location: 'الرياض - حي النخيل',
  status: 'open' as const,
}

export async function seedTestUsers(): Promise<{
  success: boolean
  message: string
  users?: { email: string; role: string; userId?: string }[]
}> {
  const createdUsers: { email: string; role: string; userId?: string }[] = []

  try {
    for (const user of TEST_USERS) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)

      if (existingUser) {
        console.log(`User ${user.email} already exists, skipping...`)
        createdUsers.push({
          email: user.email,
          role: user.role,
          userId: existingUser.id,
        })
        continue
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
        },
      })

      if (authError) {
        console.error(`Error creating user ${user.email}:`, authError)
        continue
      }

      if (!authData.user) {
        console.error(`No user returned for ${user.email}`)
        continue
      }

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: authData.user.id,
          full_name: user.fullName,
          phone: user.phone,
          role: user.role,
        })

      if (profileError) {
        console.error(`Error creating profile for ${user.email}:`, profileError)
      }

      createdUsers.push({
        email: user.email,
        role: user.role,
        userId: authData.user.id,
      })

      console.log(`Created user: ${user.email} (${user.role})`)
    }

    // Create test restaurant for restaurant owner
    const restaurantOwner = createdUsers.find(u => u.role === 'restaurant')
    if (restaurantOwner?.userId) {
      // Check if restaurant already exists
      const { data: existingRestaurant } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .eq('owner_id', restaurantOwner.userId)
        .single()

      if (!existingRestaurant) {
        const { error: restaurantError } = await supabaseAdmin
          .from('restaurants')
          .insert({
            owner_id: restaurantOwner.userId,
            name: TEST_RESTAURANT.name,
            location: TEST_RESTAURANT.location,
            status: TEST_RESTAURANT.status,
          })

        if (restaurantError) {
          console.error('Error creating test restaurant:', restaurantError)
        } else {
          console.log('Created test restaurant:', TEST_RESTAURANT.name)
        }
      } else {
        console.log('Test restaurant already exists, skipping...')
      }
    }

    return {
      success: true,
      message: `تم إنشاء ${createdUsers.length} مستخدمين تجريبيين`,
      users: createdUsers,
    }
  } catch (error) {
    console.error('Seed error:', error)
    return {
      success: false,
      message: 'حدث خطأ أثناء إنشاء البيانات التجريبية',
    }
  }
}

export async function deleteTestUsers(): Promise<{
  success: boolean
  message: string
}> {
  try {
    for (const user of TEST_USERS) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)

      if (existingUser) {
        // Delete profile first (cascade should handle this, but just in case)
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('user_id', existingUser.id)

        // Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
        console.log(`Deleted user: ${user.email}`)
      }
    }

    return {
      success: true,
      message: 'تم حذف جميع المستخدمين التجريبيين',
    }
  } catch (error) {
    console.error('Delete error:', error)
    return {
      success: false,
      message: 'حدث خطأ أثناء حذف البيانات التجريبية',
    }
  }
}

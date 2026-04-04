import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bnkhgvdoopwyivsaehfa.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const TEST_USERS = [
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

async function seedUsers() {
  console.log('Starting to seed users...')

  for (const user of TEST_USERS) {
    console.log(`\nProcessing ${user.email}...`)

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === user.email)

    if (existingUser) {
      console.log(`User ${user.email} already exists, deleting...`)
      await supabase.auth.admin.deleteUser(existingUser.id)
    }

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
      },
    })

    if (authError) {
      console.error(`Error creating user ${user.email}:`, authError.message)
      continue
    }

    console.log(`Created auth user: ${user.email} (ID: ${authData.user.id})`)

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: authData.user.id,
        full_name: user.fullName,
        phone: user.phone,
        role: user.role,
      })

    if (profileError) {
      console.error(`Error creating profile for ${user.email}:`, profileError.message)
    } else {
      console.log(`Created profile for: ${user.email} (${user.role})`)
    }
  }

  // Create test restaurant
  const { data: restaurantOwner } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('role', 'restaurant')
    .single()

  if (restaurantOwner) {
    const { error: restaurantError } = await supabase
      .from('restaurants')
      .upsert({
        name: 'مطعم الاختبار',
        location: 'الرياض - حي النخيل',
        status: 'open',
        owner_id: restaurantOwner.user_id,
      })

    if (restaurantError) {
      console.error('Error creating restaurant:', restaurantError.message)
    } else {
      console.log('\nCreated test restaurant: مطعم الاختبار')
    }
  }

  console.log('\n✅ Seeding complete!')
  console.log('\nTest credentials:')
  console.log('- customer@example.com / 123456')
  console.log('- restaurant@example.com / 123456')
  console.log('- driver@example.com / 123456')
}

seedUsers().catch(console.error)

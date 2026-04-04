import { createClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types/database.types'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.error('Error fetching user role:', error)
    return null
  }

  return data.role as UserRole
}

export async function verifyUserRole(userId: string, expectedRole: UserRole): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === expectedRole
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }

  return data
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole })
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating user role:', error)
    return false
  }

  return true
}

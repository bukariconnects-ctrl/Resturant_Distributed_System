import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types/database.types'

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

export async function getCurrentUserProfile() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  return {
    user,
    profile,
  }
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('Error signing out:', error)
    return false
  }
  
  return true
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    customer: 'عميل',
    restaurant: 'صاحب مطعم',
    driver: 'سائق توصيل',
  }
  return roleNames[role] || role
}

export function getRoleColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    customer: 'blue',
    restaurant: 'green',
    driver: 'purple',
  }
  return roleColors[role] || 'gray'
}

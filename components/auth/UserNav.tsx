'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { getRoleDisplayName } from '@/lib/auth'
import { SyncStatusIndicator } from '@/components/ui/SyncStatusIndicator'
import type { UserRole } from '@/lib/types/database.types'

interface UserProfile {
  full_name: string
  role: UserRole
}

export function UserNav() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  // Use ref to store supabase client to avoid recreating on each render
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    let isMounted = true
    const supabase = supabaseRef.current

    async function loadProfile() {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        if (isMounted) setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      
      if (user && isMounted) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('user_id', user.id)
          .single()
        
        if (data && isMounted) {
          setProfile(data as UserProfile)
        }
      }
      if (isMounted) setLoading(false)
    }

    loadProfile()

    // Cleanup to prevent state updates on unmounted component
    return () => {
      isMounted = false
    }
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => router.push('/login')}>
          تسجيل الدخول
        </Button>
        <Button onClick={() => router.push('/signup')}>
          إنشاء حساب
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <SyncStatusIndicator />
      <div className="text-sm text-right">
        <p className="font-medium">{profile.full_name}</p>
        <p className="text-muted-foreground text-xs">
          {getRoleDisplayName(profile.role)}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        تسجيل الخروج
      </Button>
    </div>
  )
}

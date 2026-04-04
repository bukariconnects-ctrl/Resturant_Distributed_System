import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicRoutes = ['/', '/login', '/signup']

const roleRoutes: Record<string, string[]> = {
  customer: ['/customer'],
  restaurant: ['/restaurant'],
  driver: ['/driver'],
}

const roleDefaultPaths: Record<string, string> = {
  customer: '/customer',
  restaurant: '/restaurant/dashboard',
  driver: '/driver/dashboard',
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Handle public routes
  if (publicRoutes.includes(pathname)) {
    // If user is logged in and trying to access login/signup, redirect to their dashboard
    if (user && (pathname === '/login' || pathname === '/signup')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (profile?.role) {
        const redirectPath = roleDefaultPaths[profile.role] || '/'
        return NextResponse.redirect(new URL(redirectPath, request.url))
      }
    }
    return supabaseResponse
  }

  // Protected routes - require authentication
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const userRole = profile.role as string
  const allowedPaths = roleRoutes[userRole] || []

  const isAllowed = allowedPaths.some(path => pathname.startsWith(path))

  if (!isAllowed) {
    const defaultPath = roleDefaultPaths[userRole] || '/'
    return NextResponse.redirect(new URL(defaultPath, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

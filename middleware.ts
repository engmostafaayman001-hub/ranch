import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from './lib/supabase'
import { canAccessDashboardByEmail } from './lib/access'
import { getRequestDashboardAccess } from './lib/server-access'

const protectedDashboardRoutes = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/team',
  '/dashboard/customers',
  '/dashboard/products',
  '/dashboard/reports',
  '/dashboard/payments',
  '/dashboard/notifications',
  '/dashboard/delivery',
  '/dashboard/settings',
  '/dashboard/pos',
]

const authRoutes = ['/login', '/register']

const routeRoles: Record<string, string[]> = {
  '/dashboard/team': ['super_admin', 'admin'],
  '/dashboard/customers': ['super_admin', 'admin', 'manager', 'support'],
  '/dashboard/products': ['super_admin', 'admin', 'manager'],
  '/dashboard/reports': ['super_admin', 'admin', 'manager'],
  '/dashboard/payments': ['super_admin', 'admin', 'cashier'],
  '/dashboard/notifications': ['super_admin', 'admin'],
  '/dashboard/delivery': ['super_admin', 'admin', 'manager', 'delivery'],
  '/dashboard/settings': ['super_admin', 'admin'],
  '/dashboard/pos': ['super_admin', 'admin', 'manager'],
}

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public routes
  if (pathname === '/' || pathname.startsWith('/menu') || pathname.startsWith('/product')) {
    return NextResponse.next()
  }

  // Create a response object to manipulate headers
  const response = NextResponse.next()

  // Create supabase server client
  const cookieStore = request.cookies
  const supabase = createSupabaseServerClient({
    getAll() {
      return cookieStore.getAll().map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
      }))
    },
    setAll(cookiesToSet: CookieToSet[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
    },
  })

  // Get current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Redirect to login if accessing protected routes without session
  if (protectedDashboardRoutes.includes(pathname)) {
    if (!session) {
      const access = await getRequestDashboardAccess(request)
      if (!access.allowed) {
        return NextResponse.redirect(new URL('/login', request.url))
      }

      const allowedRoles = routeRoles[pathname]
      if (allowedRoles && access.role && !allowedRoles.includes(access.role)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      return response
    }

    if (canAccessDashboardByEmail(session.user.email)) {
      return response
    }

    // Check if user has dashboard access
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role,status')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .single()

    if (!teamMember) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    // List of roles that can access dashboard
    const dashboardRoles = ['super_admin', 'admin', 'manager', 'cashier', 'delivery', 'support']

    if (!dashboardRoles.includes(teamMember.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    const allowedRoles = routeRoles[pathname]
    if (allowedRoles && !allowedRoles.includes(teamMember.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect authenticated users away from auth pages
  if (authRoutes.includes(pathname) && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif).*)',
  ],
}

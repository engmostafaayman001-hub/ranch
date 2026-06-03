import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from './lib/supabase'
import { canAccessDashboardByEmail } from './lib/access'

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
    const localDashboardEmail = request.cookies.get('app_user_email')?.value
    if (canAccessDashboardByEmail(localDashboardEmail)) {
      return response
    }

    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (canAccessDashboardByEmail(session.user.email)) {
      return response
    }

    // Check if user has dashboard access
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    if (!teamMember) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    // List of roles that can access dashboard
    const dashboardRoles = ['super_admin', 'admin', 'manager', 'cashier', 'delivery', 'support']

    if (!dashboardRoles.includes(teamMember.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
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

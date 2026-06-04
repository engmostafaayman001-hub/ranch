import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from './lib/supabase'
import { getRequestDashboardAccess } from './lib/server-access'
import { canRoleOpenDashboardRoute, getDefaultDashboardRouteForRole } from './lib/dashboard-permissions'

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
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const access = await getRequestDashboardAccess(request)
    if (!access.allowed) {
      return NextResponse.redirect(new URL(session ? '/unauthorized' : '/login', request.url))
    }

    if (!canRoleOpenDashboardRoute(access.role, pathname)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    const defaultRoute = getDefaultDashboardRouteForRole(access.role)
    if (pathname === '/dashboard' && defaultRoute !== '/dashboard') {
      return NextResponse.redirect(new URL(defaultRoute, request.url))
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

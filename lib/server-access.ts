import { NextRequest } from 'next/server'
import { canAccessDashboardByEmail, normalizeEmail } from '@/lib/access'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

const DASHBOARD_ROLES = ['super_admin', 'admin', 'manager', 'cashier', 'delivery', 'support']

export type DashboardAccess = {
  allowed: boolean
  userId: string | null
  email: string | null
  role: string | null
}

export function getRequestUserEmail(request: NextRequest) {
  const cookie = request.cookies.get('app_user_email')?.value
  return cookie ? normalizeEmail(decodeURIComponent(cookie)) : null
}

async function getSupabaseSessionUser(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient({
      getAll() {
        return request.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function getRequestDashboardAccess(request: NextRequest): Promise<DashboardAccess> {
  const sessionUser = await getSupabaseSessionUser(request)
  const cookieEmail = getRequestUserEmail(request)
  const email = normalizeEmail(sessionUser?.email || cookieEmail || '')

  if (!email) {
    return { allowed: false, userId: null, email: null, role: null }
  }

  if (canAccessDashboardByEmail(email)) {
    return { allowed: true, userId: sessionUser?.id || null, email, role: 'super_admin' }
  }

  try {
    const supabase = createSupabaseAdminClient()
    const appUser = sessionUser?.id
      ? { id: sessionUser.id }
      : (
          await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle()
        ).data

    if (!appUser?.id) return { allowed: false, userId: null, email, role: null }

    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role,status')
      .eq('user_id', appUser.id)
      .eq('status', 'active')
      .maybeSingle()

    const role = teamMember?.role ? String(teamMember.role) : null
    return {
      allowed: !!role && DASHBOARD_ROLES.includes(role),
      userId: appUser.id,
      email,
      role,
    }
  } catch {
    return { allowed: false, userId: null, email, role: null }
  }
}

export async function canRequestAccessDashboard(request: NextRequest) {
  return (await getRequestDashboardAccess(request)).allowed
}

import { NextRequest } from 'next/server'
import { canAccessDashboardByEmail, normalizeEmail } from '@/lib/access'
import { DASHBOARD_ROLES } from '@/lib/dashboard-permissions'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

export type DashboardAccess = {
  allowed: boolean
  userId: string | null
  email: string | null
  name: string | null
  role: string | null
}

type TeamRoleRow = {
  user_id: string
  role: string | null
  status: string | null
  users?: { name?: string | null; email?: string | null } | { name?: string | null; email?: string | null }[] | null
}

type AppUserRow = {
  id: string
  email?: string | null
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

function getTeamUserName(row: TeamRoleRow) {
  const user = Array.isArray(row.users) ? row.users[0] : row.users
  return user?.name ? String(user.name) : null
}

function roleAccess(userId: string | null, email: string, role: string | null, name: string | null = null): DashboardAccess | null {
  if (!role || !(DASHBOARD_ROLES as readonly string[]).includes(role)) return null
  return { allowed: true, userId, email, name, role }
}

export async function getRequestDashboardAccess(request: NextRequest): Promise<DashboardAccess> {
  const sessionUser = await getSupabaseSessionUser(request)
  const cookieEmail = getRequestUserEmail(request)
  const email = normalizeEmail(sessionUser?.email || cookieEmail || '')

  if (!email) {
    return { allowed: false, userId: null, email: null, name: null, role: null }
  }

  try {
    const supabase = createSupabaseAdminClient()
    const userIds = new Set<string>()
    if (sessionUser?.id) userIds.add(sessionUser.id)

    const { data: usersByEmail } = await supabase
      .from('users')
      .select('id,email')
      .eq('email', email)

    if (Array.isArray(usersByEmail)) {
      for (const user of usersByEmail as AppUserRow[]) {
        if (user.id) userIds.add(String(user.id))
      }
    }

    if (userIds.size > 0) {
      const { data: teamRows } = await supabase
        .from('team_members')
        .select('user_id,role,status,users(name,email)')
        .in('user_id', Array.from(userIds))

      const rows = Array.isArray(teamRows) ? (teamRows as TeamRoleRow[]) : []
      const activeRow = rows.find((row) => row.status === 'active' && roleAccess(String(row.user_id), email, row.role))
      const activeAccess = activeRow ? roleAccess(String(activeRow.user_id), email, activeRow.role, getTeamUserName(activeRow)) : null
      if (activeAccess) return activeAccess

      if (rows.length > 0) {
        return { allowed: false, userId: sessionUser?.id || Array.from(userIds)[0] || null, email, name: null, role: null }
      }
    }
  } catch {
    if (!canAccessDashboardByEmail(email)) {
      return { allowed: false, userId: sessionUser?.id || null, email, name: null, role: null }
    }
  }

  if (canAccessDashboardByEmail(email)) {
    return { allowed: true, userId: sessionUser?.id || null, email, name: sessionUser?.user_metadata?.name || null, role: 'super_admin' }
  }

  return { allowed: false, userId: sessionUser?.id || null, email, name: null, role: null }
}

export async function canRequestAccessDashboard(request: NextRequest) {
  return (await getRequestDashboardAccess(request)).allowed
}

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

const ACCESS_CACHE_MS = 10000
const accessCache = new Map<string, { data: DashboardAccess; at: number }>()

export function getRequestUserEmail(request: NextRequest) {
  const cookie = request.cookies.get('app_user_email')?.value
  return cookie ? normalizeEmail(decodeURIComponent(cookie)) : null
}

export async function getRequestAuthenticatedUserEmail(request: NextRequest) {
  const sessionUser = await getSupabaseSessionUser(request)
  const email = normalizeEmail(sessionUser?.email || getRequestUserEmail(request) || '')
  return email || null
}

function getAccessCacheKey(request: NextRequest) {
  return request.cookies
    .getAll()
    .filter((cookie) => cookie.name === 'app_user_email' || cookie.name.includes('auth') || cookie.name.includes('sb-'))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .sort()
    .join(';')
}

function getCachedAccess(key: string) {
  const cached = accessCache.get(key)
  if (!cached || Date.now() - cached.at > ACCESS_CACHE_MS) return null
  return cached.data
}

function setCachedAccess(key: string, data: DashboardAccess) {
  if (!key) return
  accessCache.set(key, { data, at: Date.now() })
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
  const cacheKey = getAccessCacheKey(request)
  const cached = getCachedAccess(cacheKey)
  if (cached) return cached

  const sessionUser = await getSupabaseSessionUser(request)
  const cookieEmail = getRequestUserEmail(request)
  const email = normalizeEmail(sessionUser?.email || cookieEmail || '')

  if (!email) {
    const denied = { allowed: false, userId: null, email: null, name: null, role: null }
    setCachedAccess(cacheKey, denied)
    return denied
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
      if (activeAccess) {
        setCachedAccess(cacheKey, activeAccess)
        return activeAccess
      }

      if (rows.length > 0) {
        const denied = { allowed: false, userId: sessionUser?.id || Array.from(userIds)[0] || null, email, name: null, role: null }
        setCachedAccess(cacheKey, denied)
        return denied
      }
    }
  } catch {
    if (!canAccessDashboardByEmail(email)) {
      const denied = { allowed: false, userId: sessionUser?.id || null, email, name: null, role: null }
      setCachedAccess(cacheKey, denied)
      return denied
    }
  }

  if (canAccessDashboardByEmail(email)) {
    const access = { allowed: true, userId: sessionUser?.id || null, email, name: sessionUser?.user_metadata?.name || null, role: 'super_admin' }
    setCachedAccess(cacheKey, access)
    return access
  }

  const denied = { allowed: false, userId: sessionUser?.id || null, email, name: null, role: null }
  setCachedAccess(cacheKey, denied)
  return denied
}

export async function canRequestAccessDashboard(request: NextRequest) {
  return (await getRequestDashboardAccess(request)).allowed
}

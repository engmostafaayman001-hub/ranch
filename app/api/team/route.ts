import { NextRequest } from 'next/server'
import { normalizeEmail } from '@/lib/access'
import { getRequestDashboardAccess } from '@/lib/server-access'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { UserRole } from '@/lib/types'

export const runtime = 'nodejs'

const MANAGER_ROLES = ['super_admin', 'admin']
const TEAM_ROLES = ['admin', 'supervisor', 'cashier'] as const

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...init?.headers,
    },
  })
}

function canManageTeam(role: string | null) {
  return !!role && MANAGER_ROLES.includes(role)
}

function isTeamRole(role: string): role is Exclude<UserRole, 'super_admin' | 'customer'> {
  return (TEAM_ROLES as readonly string[]).includes(role)
}

async function requireTeamManager(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return { error: json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!canManageTeam(access.role)) return { error: json({ error: 'Forbidden' }, { status: 403 }) }
  return { access }
}

async function getRestaurantId(owner: { userId: string | null; email: string | null }) {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (data?.id) return String(data.id)

  let ownerId = owner.userId

  if (ownerId) {
    const { error } = await supabase.from('users').upsert({
      id: ownerId,
      email: owner.email || `${ownerId}@ranch.local`,
      name: owner.email?.split('@')[0] || 'Ranch Admin',
    })
    if (error) throw error
  } else if (owner.email) {
    const appUser = await ensureAppUser(owner.email, owner.email.split('@')[0] || 'Ranch Admin')
    ownerId = appUser.id
  }

  if (!ownerId) {
    throw new Error('Could not determine restaurant owner')
  }

  const { data: created, error } = await supabase
    .from('restaurants')
    .insert({
      name: process.env.NEXT_PUBLIC_APP_NAME_EN || 'Ranch',
      address: 'Cairo, Egypt',
      phone: '01000000000',
      owner_id: ownerId,
    })
    .select('id')
    .single()

  if (error) throw error
  return String(created.id)
}

async function findAppUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('users')
    .select('id,email,name')
    .eq('email', email)
    .maybeSingle()

  return data
}

async function ensureAppUser(email: string, name: string) {
  const existing = await findAppUserByEmail(email)
  if (existing?.id) {
    const supabase = createSupabaseAdminClient()
    const userId = String(existing.id)

    if (name && String(existing.name || '') !== name) {
      const { error } = await supabase.from('users').update({ name }).eq('id', userId)
      if (error) throw error

      try {
        await supabase.auth.admin.updateUserById(userId, { user_metadata: { name } })
      } catch {
        // Keep app user data updated even if auth metadata syncing is not available.
      }
    }

    return { id: userId, tempPassword: null }
  }

  const supabase = createSupabaseAdminClient()
  const tempPassword = Math.random().toString(36).slice(2, 12)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name },
  })

  let userId = authData.user?.id || null

  if (authError) {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listError) throw authError
    userId = usersData.users.find((user) => user.email?.toLowerCase() === email)?.id || null
    if (!userId) throw authError
  }

  if (!userId) throw new Error('Could not create auth user')

  const { error: userError } = await supabase.from('users').upsert({
    id: userId,
    email,
    name,
  })

  if (userError) throw userError
  return { id: userId, tempPassword: authError ? null : tempPassword }
}

export async function GET(request: NextRequest) {
  const guard = await requireTeamManager(request)
  if ('error' in guard) return guard.error

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('team_members')
      .select('id,user_id,role,status,users(email,name)')
      .order('created_at', { ascending: false })

    if (error) throw error

    const members = (data || []).map((member) => {
      const user = Array.isArray(member.users) ? member.users[0] : member.users
      return {
        id: String(member.id),
        userId: String(member.user_id),
        name: String(user?.name || user?.email?.split('@')[0] || ''),
        email: String(user?.email || ''),
        role: String(member.role),
        status: String(member.status) === 'active' ? 'active' : 'inactive',
      }
    })

    return json({ members })
  } catch (error) {
    return json(
      { error: 'Could not load team members', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireTeamManager(request)
  if ('error' in guard) return guard.error

  try {
    const body = await request.json()
    const email = normalizeEmail(String(body.email || ''))
    const name = String(body.name || '').trim()
    const role = String(body.role || 'manager')
    const status = String(body.status || 'active') === 'inactive' ? 'inactive' : 'active'

    if (!email || !name) return json({ error: 'Name and email are required' }, { status: 400 })
    if (!isTeamRole(role)) return json({ error: 'Invalid role' }, { status: 400 })

    const restaurantId = await getRestaurantId({
      userId: guard.access.userId,
      email: guard.access.email,
    })

    const supabase = createSupabaseAdminClient()
    const appUser = await ensureAppUser(email, name)
    const { data, error } = await supabase
      .from('team_members')
      .upsert({
        user_id: appUser.id,
        restaurant_id: restaurantId,
        role,
        status,
      }, { onConflict: 'user_id,restaurant_id' })
      .select('id,user_id,role,status')
      .single()

    if (error) throw error

    return json({
      member: {
        id: String(data.id),
        userId: String(data.user_id),
        name,
        email,
        role: String(data.role),
        status: String(data.status) === 'active' ? 'active' : 'inactive',
      },
      tempPassword: appUser.tempPassword,
    }, { status: 201 })
  } catch (error) {
    return json(
      { error: 'Could not save team member', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireTeamManager(request)
  if ('error' in guard) return guard.error

  try {
    const body = await request.json()
    const id = String(body.id || '')
    const updates: Record<string, string> = {}
    const userUpdates: Record<string, string> = {}
    const name = typeof body.name === 'string' ? String(body.name).trim() : ''
    const email = typeof body.email === 'string' ? normalizeEmail(String(body.email)) : ''

    if (!id) return json({ error: 'Member id is required' }, { status: 400 })
    if (body.role && isTeamRole(String(body.role))) updates.role = String(body.role)
    if (body.status) updates.status = String(body.status) === 'active' ? 'active' : 'inactive'
    if (name) userUpdates.name = name
    if (email) userUpdates.email = email

    if (body.role && !isTeamRole(String(body.role))) return json({ error: 'Invalid role' }, { status: 400 })
    if (Object.keys(updates).length === 0 && Object.keys(userUpdates).length === 0) {
      return json({ error: 'No updates provided' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: currentMember, error: currentMemberError } = await supabase
      .from('team_members')
      .select('id,user_id,role,status,users(email,name)')
      .eq('id', id)
      .single()

    if (currentMemberError) throw currentMemberError

    let data = currentMember
    if (Object.keys(updates).length > 0) {
      const { data: updatedMember, error } = await supabase
        .from('team_members')
        .update(updates)
        .eq('id', id)
        .select('id,user_id,role,status,users(email,name)')
        .single()

      if (error) throw error
      data = updatedMember
    }

    if (Object.keys(userUpdates).length > 0) {
      const userId = String(data.user_id)
      if (email) {
        const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
          user_metadata: name ? { name } : undefined,
        })
        if (authError) throw authError
      } else if (name) {
        try {
          await supabase.auth.admin.updateUserById(userId, { user_metadata: { name } })
        } catch {
          // Keep app user data updated even if auth metadata syncing is not available.
        }
      }

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', userId)

      if (userError) throw userError

      const { data: refreshedMember, error: refreshedError } = await supabase
        .from('team_members')
        .select('id,user_id,role,status,users(email,name)')
        .eq('id', id)
        .single()

      if (refreshedError) throw refreshedError
      data = refreshedMember
    }

    const user = Array.isArray(data.users) ? data.users[0] : data.users

    return json({
      member: {
        id: String(data.id),
        userId: String(data.user_id),
        name: String(user?.name || user?.email?.split('@')[0] || ''),
        email: String(user?.email || ''),
        role: String(data.role),
        status: String(data.status) === 'active' ? 'active' : 'inactive',
      },
    })
  } catch (error) {
    return json(
      { error: 'Could not update team member', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireTeamManager(request)
  if ('error' in guard) return guard.error

  try {
    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return json({ error: 'Member id is required' }, { status: 400 })

    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('team_members').delete().eq('id', id)
    if (error) throw error

    return json({ deleted: true, id })
  } catch (error) {
    return json(
      { error: 'Could not delete team member', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

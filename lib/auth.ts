import { User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient, createSupabaseAdminClient } from './supabase'
import { UserRole } from './types'

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = createSupabaseBrowserClient()
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role as UserRole | null
}

export async function getUserRestaurant(userId: string) {
  const supabase = createSupabaseBrowserClient()
  const { data } = await supabase
    .from('team_members')
    .select('restaurant_id')
    .eq('user_id', userId)
    .single()
  return data?.restaurant_id
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
) {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) throw error

    return data
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
        throw new Error('System configuration error: Supabase is not properly configured. Please contact support.')
      }
    }
    throw error
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    return data
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
        throw new Error('System configuration error: Supabase is not properly configured. Please contact support.')
      }
    }
    throw error
  }
}

export async function signInWithGoogle(nextPath = '/') {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error) throw error

  return data
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.auth.signOut()

  if (error) throw error
}

export async function resetPassword(email: string) {
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
  })

  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) throw error
}

// Admin functions
export async function createSuperAdmin(email: string, password: string) {
  const adminClient = createSupabaseAdminClient()

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) throw error

  return data
}

export async function createTeamMember(
  email: string,
  name: string,
  restaurantId: string,
  role: UserRole,
  password?: string
) {
  const adminClient = createSupabaseAdminClient()

  const tempPassword = password || Math.random().toString(36).slice(-10)

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

  if (authError) throw authError

  const { error: userError } = await adminClient
    .from('users')
    .insert([
      {
        id: authData.user.id,
        email,
        name,
      },
    ])

  if (userError) throw userError

  const { error: teamError } = await adminClient
    .from('team_members')
    .insert([
      {
        user_id: authData.user.id,
        restaurant_id: restaurantId,
        role,
        status: 'active',
      },
    ])

  if (teamError) throw teamError

  return { userId: authData.user.id, tempPassword }
}

export async function setUserRole(
  userId: string,
  restaurantId: string,
  role: UserRole
) {
  const adminClient = createSupabaseAdminClient()

  const { error } = await adminClient
    .from('team_members')
    .update({ role })
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)

  if (error) throw error
}

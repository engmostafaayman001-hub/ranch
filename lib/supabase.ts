import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

type SupabaseCookieStore = {
  getAll: () => { name: string; value: string }[]
  set?: (name: string, value: string, options?: Record<string, unknown>) => void
  setAll?: (cookiesToSet: CookieToSet[]) => void
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export function createSupabaseServerClient(
  cookieStore: SupabaseCookieStore
) {
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set?.(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component
            // This can be ignored if you have middleware handling cookie setting separately.
          }
        },
      },
    }
  )
}

export function createSupabaseAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Export default client for compatibility
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

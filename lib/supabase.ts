import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>

declare global {
  // Keep one auth client across module reloads in the browser.
  // Multiple GoTrueClient instances with the same storage key can race each other.
  var __ranchSupabaseBrowserClient: SupabaseBrowserClient | undefined
}

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
  if (typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  if (!globalThis.__ranchSupabaseBrowserClient) {
    globalThis.__ranchSupabaseBrowserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return globalThis.__ranchSupabaseBrowserClient
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

export const supabase = createSupabaseBrowserClient

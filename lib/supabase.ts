import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

function validateSupabaseConfig() {
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Please set the Supabase URL in your environment variables.'
    )
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Please set the Supabase anon key in your environment variables.'
    )
  }
}

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
  validateSupabaseConfig()
  
  if (typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl as string, supabaseAnonKey as string)
  }

  if (!globalThis.__ranchSupabaseBrowserClient) {
    globalThis.__ranchSupabaseBrowserClient = createBrowserClient(supabaseUrl as string, supabaseAnonKey as string)
  }

  return globalThis.__ranchSupabaseBrowserClient
}

export function createSupabaseServerClient(
  cookieStore: SupabaseCookieStore
) {
  validateSupabaseConfig()
  
  return createServerClient(
    supabaseUrl as string,
    supabaseAnonKey as string,
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
  validateSupabaseConfig()
  return createClient(supabaseUrl as string, supabaseServiceKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const supabase = createSupabaseBrowserClient

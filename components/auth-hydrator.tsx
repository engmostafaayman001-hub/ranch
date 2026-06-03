'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export function AuthHydrator() {
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    const hydrate = async () => {
      const stored = localStorage.getItem('user')
      if (stored) {
        setUser(JSON.parse(stored))
        return
      }

      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(
        user
          ? {
              id: user.id,
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              email: user.email || '',
            }
          : null
      )
    }

    hydrate().catch(() => setUser(null))
  }, [setUser])

  return null
}

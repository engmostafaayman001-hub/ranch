'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export function AuthHydrator() {
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    const hydrate = async () => {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        setUser({
          id: user.id,
          name: user.user_metadata?.name || user.email.split('@')[0] || 'User',
          email: user.email,
        })
        return
      }

      const stored = localStorage.getItem('user')
      setUser(stored ? JSON.parse(stored) : null)
    }

    hydrate().catch(() => setUser(null))
  }, [setUser])

  return null
}

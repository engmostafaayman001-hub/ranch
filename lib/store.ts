import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
}

interface AuthStore {
  user: User | null
  isLoggedIn: boolean
  login: (user: User) => void
  logout: () => void
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoggedIn: false,
  login: (user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user))
      document.cookie = `app_user_email=${encodeURIComponent(user.email)}; path=/; max-age=2592000; SameSite=Lax`
    }
    set({ user, isLoggedIn: true })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user')
      document.cookie = 'app_user_email=; path=/; max-age=0; SameSite=Lax'
    }
    set({ user: null, isLoggedIn: false })
  },
  setUser: (user: User | null) => {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('user', JSON.stringify(user))
        document.cookie = `app_user_email=${encodeURIComponent(user.email)}; path=/; max-age=2592000; SameSite=Lax`
      } else {
        localStorage.removeItem('user')
        document.cookie = 'app_user_email=; path=/; max-age=0; SameSite=Lax'
      }
    }
    set({ user, isLoggedIn: !!user })
  },
}))

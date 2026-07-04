import React, { createContext, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '../lib/api'
import {
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  getMe,
} from '../lib/auth'
import type { User } from '../lib/types'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, full_name: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function bootstrap(): Promise<void> {
      try {
        const me = await getMe()
        if (!cancelled) setUser(me)
      } catch (err) {
        // A 401 on mount is expected (no active session) and must not crash
        // nor surface as an unhandled error. Anything else is unexpected.
        if (err instanceof ApiError && err.status === 401) {
          if (!cancelled) setUser(null)
        } else if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    // Let ApiError propagate to the caller; leave `user` untouched on failure.
    await authLogin({ email, password })
    const me = await getMe()
    setUser(me)
  }, [])

  const register = useCallback(
    async (email: string, password: string, full_name: string): Promise<void> => {
      await authRegister({ email, password, full_name })
      const me = await getMe()
      setUser(me)
    },
    [],
  )

  const logout = useCallback(async (): Promise<void> => {
    // Always clear the local session, even if the network call fails.
    try {
      await authLogout()
    } finally {
      setUser(null)
    }
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

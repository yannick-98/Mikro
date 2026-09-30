import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function restore() {
      if (!tokenStore.get()) {
        setLoading(false)
        return
      }
      try {
        const { user: me } = await api.me()
        if (alive) setUser(me)
      } catch {
        tokenStore.clear()
      } finally {
        if (alive) setLoading(false)
      }
    }
    restore()
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { token, user: me } = await api.login(credentials)
    tokenStore.set(token)
    setUser(me)
    return me
  }, [])

  const register = useCallback(async (payload) => {
    const { token, user: me } = await api.register(payload)
    tokenStore.set(token)
    setUser(me)
    return me
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await api.me()
      setUser(me)
      return me
    } catch {
      return null
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      isBrand: user?.role === 'BRAND',
      isCreator: user?.role === 'CREATOR',
      isAdmin: user?.role === 'ADMIN',
    }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

/** Ruta del panel segun el rol, para redirigir despues de iniciar sesion. */
export function homeFor(user) {
  if (!user) return '/'
  if (user.role === 'BRAND') return '/empresa'
  if (user.role === 'CREATOR') return '/creador'
  if (user.role === 'ADMIN') return '/admin'
  return '/'
}

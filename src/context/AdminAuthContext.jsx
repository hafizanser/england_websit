import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { adminLogin, adminLogout, adminMe } from '../api/admin'
import { getAdminToken } from '../api/http'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const token = getAdminToken()
    if (!token) {
      setLoading(false)
      return
    }
    adminMe()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const u = await adminLogin(username, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await adminLogout()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}

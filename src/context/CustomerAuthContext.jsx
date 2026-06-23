import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { registerCustomer, loginCustomer, phoneLoginCustomer, logoutCustomer, customerMe } from '../api/customer'
import { getCustomerToken, setCustomerToken } from '../api/http'

const CustomerAuthContext = createContext(null)

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the session on load if a token exists.
  useEffect(() => {
    let alive = true
    const token = getCustomerToken()
    if (!token) {
      setLoading(false)
      return
    }
    customerMe()
      .then((c) => alive && setCustomer(c))
      .catch(() => alive && setCustomer(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (identifier, password) => {
    const c = await loginCustomer(identifier, password)
    setCustomer(c)
    return c
  }, [])

  const register = useCallback(async (payload) => {
    const c = await registerCustomer(payload)
    setCustomer(c)
    return c
  }, [])

  // Mobile-number-only login/registration.
  const phoneLogin = useCallback(async (payload) => {
    const c = await phoneLoginCustomer(payload)
    setCustomer(c)
    return c
  }, [])

  const logout = useCallback(async () => {
    await logoutCustomer()
    setCustomer(null)
  }, [])

  // Adopt a session handed back by another flow (e.g. guest checkout, which
  // auto-creates the account and returns a token). Logs the shopper in instantly.
  const adoptSession = useCallback((cust, token) => {
    if (token) setCustomerToken(token)
    if (cust) setCustomer(cust)
  }, [])

  const value = useMemo(
    () => ({ customer, isLoggedIn: !!customer, loading, login, register, phoneLogin, logout, adoptSession }),
    [customer, loading, login, register, phoneLogin, logout, adoptSession],
  )
  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider')
  return ctx
}

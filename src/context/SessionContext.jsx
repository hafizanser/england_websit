import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'

const KEY = 'barkat.customer.v1'
const SessionContext = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function SessionProvider({ children }) {
  const [customer, setCustomerState] = useState(load)

  useEffect(() => {
    try {
      if (customer) localStorage.setItem(KEY, JSON.stringify(customer))
      else localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }, [customer])

  const setCustomer = useCallback((c) => setCustomerState(c), [])
  const clearCustomer = useCallback(() => setCustomerState(null), [])

  const value = useMemo(
    () => ({ customer, isLoggedIn: !!customer, setCustomer, clearCustomer }),
    [customer, setCustomer, clearCustomer],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}

import { http, setCustomerToken } from './http'

// Register a new customer account (or upgrade an existing guest account).
export async function registerCustomer(payload) {
  const res = await http.post('/auth/customer/register', payload)
  setCustomerToken(res.token)
  return res.customer
}

// Log in with phone OR email + password.
export async function loginCustomer(identifier, password) {
  const res = await http.post('/auth/customer/login', { identifier, password })
  setCustomerToken(res.token)
  return res.customer
}

// Mobile-number-only login/registration — the 11-digit phone is the identity.
// Existing numbers log in; new numbers create an account on the spot.
export async function phoneLoginCustomer(payload) {
  const res = await http.post('/auth/customer/phone-login', payload)
  setCustomerToken(res.token)
  return res.customer
}

export async function logoutCustomer() {
  try {
    await http.post('/auth/customer/logout', {}, { customerAuth: true })
  } catch {
    /* ignore */
  }
  setCustomerToken(null)
}

// Current logged-in customer (validates the stored token on app load).
export async function customerMe() {
  const res = await http.get('/auth/customer/me', { customerAuth: true })
  return res.customer
}

// Logged-in customer's own order history.
export async function getMyOrders() {
  return http.get('/customer/orders', { customerAuth: true })
}

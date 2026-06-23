import { http } from './http'

// Per-customer saved cart — persists across logins until the shopper clears it.
export async function getServerCart() {
  return (await http.get('/customer/cart', { customerAuth: true })).data
}

export async function saveServerCart(rows, code = null) {
  return (await http.put('/customer/cart', { rows, code }, { customerAuth: true })).data
}

export async function clearServerCart() {
  return (await http.del('/customer/cart', { customerAuth: true })).data
}

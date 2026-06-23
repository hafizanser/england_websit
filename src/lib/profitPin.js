// Shares the verified profit PIN between the Profit List and Profit Details
// pages for the duration of the browser session (cleared on tab close).
const KEY = 'barkat.profit.pin'

export const getProfitPin = () => {
  try {
    return sessionStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export const setProfitPin = (pin) => {
  try {
    if (pin) sessionStorage.setItem(KEY, pin)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

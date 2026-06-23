// Single source of truth for WhatsApp deep links.
// WA_NUMBER is the bare international number (no +, spaces or dashes) that wa.me
// expects. Keep this the ONLY place the order number is hard-coded.
export const WA_NUMBER = '923124361300'

// Build a wa.me deep link with an optional, URL-encoded prefilled message.
//   waLink('Salam')  -> https://wa.me/923124361300?text=Salam
//   waLink()         -> https://wa.me/923124361300
export const waLink = (msg = '') =>
  `https://wa.me/${WA_NUMBER}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`

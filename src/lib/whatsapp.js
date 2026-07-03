// Single source of truth for WhatsApp deep links.
// WA_NUMBER is the bare international number (no +, spaces or dashes) that wa.me
// expects. Keep this the ONLY place the order number is hard-coded.
export const WA_NUMBER = '923124361300'

// Build a wa.me deep link with an optional, URL-encoded prefilled message.
//   waLink('Salam')  -> https://wa.me/923124361300?text=Salam
//   waLink()         -> https://wa.me/923124361300
export const waLink = (msg = '') =>
  `https://wa.me/${WA_NUMBER}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`

// Prefilled product-enquiry message used by every "Enquire on WhatsApp" button
// (product cards + product detail). Prices are hidden across the site, so the
// customer asks for the rate here — the message carries the exact product name
// and the unit they picked (Carton / Box / Bundle / …).
export const enquiryMessage = (productName, unitLabel) =>
  `Assalam-o-Alaikum,\n` +
  `Main ye product buy karna chahta hoon.\n\n` +
  `Product: ${productName || ''}\n` +
  `Unit: ${unitLabel || ''}\n\n` +
  `Please price aur availability share kar dein. Shukriya.`

// wa.me deep link for a product enquiry (name + selected unit).
export const enquiryHref = (productName, unitLabel) =>
  waLink(enquiryMessage(productName, unitLabel))

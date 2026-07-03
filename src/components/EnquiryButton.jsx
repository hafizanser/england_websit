import { WhatsappLogo } from '@phosphor-icons/react'
import { enquiryHref } from '../lib/whatsapp'

// Premium, site-consistent WhatsApp enquiry button. Replaces every "Add to cart"
// action on product surfaces: opens WhatsApp with a prefilled message carrying the
// product name + the unit the customer selected, so they can ask for the rate.
//
//   <EnquiryButton name={p.name} unit={selected.label} />
//
// `size`  sm | md | lg   controls height + typography (cards use sm/md, the
//                        product detail page uses lg).
// `full`  stretch to the container width (default true).
const SIZES = {
  sm: { cls: 'h-10 gap-1.5 px-3 text-xs', icon: 16 },
  md: { cls: 'h-11 gap-2 px-4 text-sm', icon: 18 },
  lg: { cls: 'h-12 gap-2.5 px-6 text-[15px]', icon: 20 },
}

export default function EnquiryButton({
  name,
  unit,
  size = 'md',
  full = true,
  label = 'WhatsApp pe poochein',
  className = '',
}) {
  const s = SIZES[size] || SIZES.md
  return (
    <a
      href={enquiryHref(name, unit)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name}${unit ? ` (${unit})` : ''} — WhatsApp par rate poochein`}
      className={`group inline-flex items-center justify-center rounded-full bg-[#25D366] font-bold text-white shadow-soft ring-1 ring-inset ring-white/20 transition-all hover:bg-[#1ebe5d] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d] ${full ? 'w-full' : ''} ${s.cls} ${className}`}
    >
      <WhatsappLogo size={s.icon} weight="fill" className="shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  )
}

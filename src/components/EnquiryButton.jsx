import { WhatsappLogo } from '@phosphor-icons/react'
import { enquiryHref } from '../lib/whatsapp'

// Premium, site-consistent WhatsApp button. Replaces every "Add to cart" action on
// product surfaces: opens WhatsApp with a prefilled message carrying the product
// name + the unit the customer selected.
//
//   <EnquiryButton name={p.name} unit={selected.label} />
//
// Design goals (mobile-first, consistent on desktop):
//   • generous touch height (>= 44px) + balanced padding
//   • icon + label perfectly centred, never wrapping (whitespace-nowrap)
//   • fully rounded pill, subtle ring + shadow, smooth hover-lift & tap-press
//   • full-width by default so it reads as a primary CTA in any card/panel
//
// `size`  sm | md | lg   controls height + typography (cards use sm/md, the
//                        product detail page uses lg). `full` stretches to width.
// Text scales up on wider screens; on narrow 2-col mobile cards it stays compact
// with tight padding so "Order on WhatsApp" fits on ONE line without truncation.
const SIZES = {
  sm: { cls: 'h-11 gap-1.5 px-2.5 text-[10.5px] sm:text-xs', icon: 15 },
  md: { cls: 'h-11 gap-1.5 px-3 text-[11px] sm:text-sm', icon: 16 },
  lg: { cls: 'h-[52px] gap-2.5 px-6 text-[15px]', icon: 20 },
}

export default function EnquiryButton({
  name,
  unit,
  size = 'md',
  full = true,
  label = 'Order on WhatsApp',
  className = '',
}) {
  const s = SIZES[size] || SIZES.md
  return (
    <a
      href={enquiryHref(name, unit)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}${name ? ` — ${name}` : ''}${unit ? ` (${unit})` : ''}`}
      className={`group inline-flex select-none items-center justify-center rounded-full bg-[#25D366] font-bold leading-none text-white shadow-md ring-1 ring-inset ring-white/25 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#20bd5a] hover:shadow-lg active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d] ${full ? 'w-full' : ''} ${s.cls} ${className}`}
    >
      <WhatsappLogo size={s.icon} weight="fill" className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
      <span className="whitespace-nowrap">{label}</span>
    </a>
  )
}

import { Globe, Headset } from '@phosphor-icons/react'

const meta = {
  website: { label: 'Website', icon: Globe, cls: 'bg-brand-50 text-brand-700' },
  admin: { label: 'Admin', icon: Headset, cls: 'bg-saffron-50 text-saffron-700' },
}

export function SourceBadge({ source = 'website', size = 'md' }) {
  const m = meta[source] || meta.website
  const Icon = m.icon
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${pad} ${m.cls}`}>
      <Icon size={size === 'sm' ? 11 : 13} weight="fill" /> {m.label}
    </span>
  )
}

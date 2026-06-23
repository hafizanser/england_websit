import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { House, CaretRight, CaretLeft } from '@phosphor-icons/react'
import { Eyebrow } from './ui'

// Inner-page hero with breadcrumb. Dark brand band consistent with the theme.
export default function PageHeader({ eyebrow, title, accent, urdu, desc, crumb, hideCrumb = false, children }) {
  const navigate = useNavigate()
  return (
    <section className="relative overflow-hidden bg-brand-950 text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-saffron-400/10 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="container-page relative py-7 sm:py-16">
        {/* App-style back affordance — phones only; desktop relies on nav/breadcrumbs */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Wapas jayein"
          className="press tap-target mb-4 -ml-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15 md:hidden"
        >
          <CaretLeft size={16} weight="bold" /> Wapas
        </button>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          className="max-w-2xl"
        >
          {eyebrow && <Eyebrow tone="light">{eyebrow}</Eyebrow>}
          <h1 className="mt-4 text-balance text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
            {title} {accent && <span className="text-saffron-300">{accent}</span>}
          </h1>
          {urdu && (
            <p className="urdu mt-3 text-xl text-white/85" dir="rtl">
              {urdu}
            </p>
          )}
          {desc && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">{desc}</p>}
          {children && <div className="mt-6">{children}</div>}
        </motion.div>
      </div>
    </section>
  )
}

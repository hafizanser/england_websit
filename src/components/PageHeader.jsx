import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { House, CaretRight, CaretLeft } from '@phosphor-icons/react'
import { Eyebrow } from './ui'

// Inner-page hero with breadcrumb. Dark brand band consistent with the theme.
export default function PageHeader({ eyebrow, title, accent, urdu, desc, crumb, hideCrumb = false, children }) {
  const navigate = useNavigate()
  return (
    <section className="relative overflow-hidden border-b border-brand-900/[0.06] bg-[#FBF8F2] text-brand-950">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-saffron-300/20 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(40,28,14,0.10) 1px, transparent 0)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(90deg, #000, transparent 70%)',
          WebkitMaskImage: 'linear-gradient(90deg, #000, transparent 70%)',
        }}
      />

      <div className="container-page relative py-7 sm:py-16">
        {/* App-style back affordance — phones only; desktop relies on nav/breadcrumbs */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Wapas jayein"
          className="press tap-target mb-4 -ml-1 inline-flex items-center gap-1.5 rounded-xl border border-brand-900/10 bg-white px-3.5 py-2 text-sm font-semibold text-brand-800 transition-colors hover:bg-sand-100 md:hidden"
        >
          <CaretLeft size={16} weight="bold" /> Wapas
        </button>
        <motion.div
          initial={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          className="max-w-2xl"
        >
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="mt-4 text-balance font-grotesk text-[32px] font-extrabold uppercase leading-[0.95] tracking-[-0.035em] sm:mt-5 sm:text-5xl md:text-[58px]">
            {title} {accent && <span className="text-saffron-500">{accent}</span>}
          </h1>
          {urdu && (
            <p className="urdu mt-3 text-xl text-saffron-600 sm:text-2xl" dir="rtl" style={{ width: 'fit-content', maxWidth: '100%' }}>
              {urdu}
            </p>
          )}
          {desc && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-brand-600 sm:text-[17px]">{desc}</p>}
          {children && <div className="mt-6">{children}</div>}
        </motion.div>
      </div>
    </section>
  )
}

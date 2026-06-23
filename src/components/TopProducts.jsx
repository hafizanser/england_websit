import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Package, ArrowUpRight } from '@phosphor-icons/react'
import { getTopSelling } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'
import { SectionHeading, ProductSkeleton, ErrorState, EmptyState } from './ui'
import ProductCard from './ProductCard'

const filters = ['Sab', 'Tissues', 'Soap', 'Shampoo', 'Baby Care', 'Agarbati']

export default function TopProducts() {
  const [active, setActive] = useState('Sab')
  const { data, loading, error, reload } = useAsync(() => getTopSelling(), [])

  const shown = useMemo(() => {
    const list = data || []
    if (active === 'Sab') return list
    return list.filter((p) => p.category === active)
  }, [data, active])

  return (
    <section id="products" className="scroll-mt-24 bg-white py-16 sm:py-24">
      <div className="container-page">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading
              eyebrow="Sab se zyada bikne wale"
              tone="saffron"
              title="Top selling"
              accent="products"
              urdu="جو سب سے زیادہ بکتا ہے"
              desc="Yehi woh maal hai jo har dukaan par sab se tezi se bikta hai — mota margin, pakka rate."
            />
            <Link
              to="/products"
              className="hidden shrink-0 items-center gap-2 rounded-full border border-brand-200 px-5 py-3 text-sm font-semibold text-brand-800 transition-all hover:bg-sand-50 sm:inline-flex"
            >
              Saare products <ArrowUpRight size={16} weight="bold" />
            </Link>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActive(f)}
                className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active === f ? 'text-white' : 'text-brand-700 hover:text-brand-900'
                }`}
              >
                {active === f && (
                  <motion.span
                    layoutId="home-filter-pill"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-brand-700 shadow-soft"
                  />
                )}
                <span className="relative z-10">{f}</span>
              </button>
            ))}
          </div>
        </div>

        <motion.div layout className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}

          {!loading && error && <ErrorState message={error.message} onRetry={reload} />}

          {!loading && !error && (
            <AnimatePresence mode="popLayout">
              {shown.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </AnimatePresence>
          )}

          {!loading && !error && shown.length === 0 && (
            <EmptyState
              icon={Package}
              title="Is category mein abhi koi top product nahi"
              text="Doosri category chunein ya saare products dekhein."
            />
          )}
        </motion.div>

        <div className="mt-8 flex justify-center sm:hidden">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-6 py-3 text-sm font-semibold text-brand-800"
          >
            Saare products dekhein <ArrowUpRight size={16} weight="bold" />
          </Link>
        </div>
      </div>
    </section>
  )
}

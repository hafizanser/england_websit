import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkle } from '@phosphor-icons/react'
import ProductCard from './ProductCard'
import { ProductSkeleton } from './ui'
import { getProducts } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'

// Fisher–Yates shuffle (returns a new array) — used to randomise the "other
// category" fillers so the section feels fresh on each visit.
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const MAX = 4

/**
 * RELATED PRODUCTS — shown below the product details.
 *
 * Selection order (never any duplicate, current product always excluded):
 *   1. products from the SAME category as the current product,
 *   2. if fewer than 4 remain, the slots are topped up with RANDOM products
 *      from other categories.
 * Cards reuse the exact <ProductCard> used on the Products page, so Add-to-Cart,
 * offers, pricing and stock all keep working with zero extra wiring.
 */
export default function RelatedProducts({ product }) {
  // One fetch of the full catalogue gives us both the same-category matches and
  // the cross-category fillers without a second round-trip.
  const { data, loading } = useAsync(() => getProducts({ sort: 'popular' }), [])

  const related = useMemo(() => {
    const all = Array.isArray(data) ? data : []
    const pool = all.filter((x) => String(x.id) !== String(product?.id))
    const seen = new Set()
    const picked = []

    // 1) same category first
    for (const x of pool) {
      if (picked.length >= MAX) break
      if (String(x.categoryId) === String(product?.categoryId) && !seen.has(x.id)) {
        seen.add(x.id)
        picked.push(x)
      }
    }
    // 2) fill remaining slots with random products from other categories
    if (picked.length < MAX) {
      for (const x of shuffle(pool.filter((x) => !seen.has(x.id)))) {
        if (picked.length >= MAX) break
        seen.add(x.id)
        picked.push(x)
      }
    }
    return picked
  }, [data, product?.id, product?.categoryId])

  // Nothing to relate to (e.g. the only product in the store) → render nothing.
  if (!loading && related.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mt-14 sm:mt-20"
      aria-label="Related products"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron-400 text-brand-950">
          <Sparkle size={18} weight="fill" />
        </span>
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">
            Related Products
          </h2>
          <p className="text-xs text-brand-500 sm:text-sm">You may also like these products</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 min-[760px]:grid-cols-3 min-[1100px]:grid-cols-4">
        {loading
          ? Array.from({ length: MAX }).map((_, i) => <ProductSkeleton key={i} />)
          : related.map((p) => <ProductCard key={p.id} p={p} preferLargestUnit />)}
      </div>
    </motion.section>
  )
}

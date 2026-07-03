import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MagnifyingGlass, Headset, Package } from '@phosphor-icons/react'
import { getProducts, getCategories } from '../../api/catalog'
import { useAsync } from '../../hooks/useAsync'
import ProductCard from '../../components/ProductCard'
import { ProductSkeleton } from '../../components/ui'

const GRID_CAP = 24 // safeguard against huge catalogs — chips + search narrow it

// Flat cream surface panel — matches the reference (.panel): #FBF7EE fill, hairline
// #E6DCC5 border, 14px radius, subtle diffusion shadow.
function Panel({ className = '', children }) {
  return (
    <div className={`rounded-[14px] border border-[#E6DCC5] bg-[#FBF7EE] shadow-[0_1px_2px_rgba(58,46,31,0.06),0_1px_3px_rgba(58,46,31,0.05)] ${className}`}>
      {children}
    </div>
  )
}

export default function AdminCreateOrder() {
  const { data: products, loading: productsLoading, error: productsError, reload } = useAsync(() => getProducts({ sort: 'popular' }), [])
  const { data: categories } = useAsync(() => getCategories(), [])

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [cat, setCat] = useState('all')

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200)
    return () => clearTimeout(t)
  }, [q])

  const categoryList = categories || []
  const catCounts = useMemo(() => {
    const m = {}
    ;(products || []).forEach((p) => { m[p.categoryId] = (m[p.categoryId] || 0) + 1 })
    return m
  }, [products])

  const results = useMemo(() => {
    if (!products) return []
    let list = products
    if (cat !== 'all') list = list.filter((p) => String(p.categoryId) === String(cat))
    const n = debouncedQ.trim().toLowerCase()
    if (n) list = list.filter((p) => p.name.toLowerCase().includes(n) || (p.category || '').toLowerCase().includes(n))
    return list
  }, [products, cat, debouncedQ])
  const capped = results.slice(0, GRID_CAP)

  return (
    <div className="mx-auto max-w-[1440px]">
      <Link to="/admin/orders" className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-[13px] font-semibold text-[#6E6250] transition-colors hover:text-[#2A2117]">
        <ArrowLeft size={15} weight="bold" /> Orders
      </Link>

      <div className="mb-5 mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.02em] text-[#2A2117] sm:text-[30px]">Naya order banayein</h1>
          <p className="mt-2 text-sm text-[#6E6250]">Product chunein aur WhatsApp par rate poochein</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E6DCC5] bg-[#FBF7EE] px-3.5 py-2 text-[13px] font-semibold text-[#6E6250] shadow-[0_1px_2px_rgba(58,46,31,0.06)]">
          <Headset size={15} weight="fill" className="text-[#C29A45]" /> Source: Admin
        </span>
      </div>

      {/* Full-width product picker — single natural page scroll. */}
      <div className="grid gap-[22px]">
        {/* ── product picker ── */}
        <Panel className="p-5">
          <h2 className="mb-3.5 text-base font-extrabold tracking-[-0.01em] text-[#2A2117]">Products</h2>

          <div className="relative mb-3.5">
            <MagnifyingGlass size={17} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C9078]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product dhoondein… (naam ya category)"
              className="w-full rounded-[11px] border border-[#D9CDB1] bg-white py-3 pl-10 pr-4 text-sm text-[#2A2117] outline-none transition-all placeholder:text-[#9C9078] focus:border-[#3A2E1F] focus:ring-4 focus:ring-[#3A2E1F]/10"
            />
          </div>

          {/* category chips with counts — wrap to match the theme (.chips: flex-wrap) */}
          <div className="mb-[18px] flex flex-wrap gap-2">
            <Chip active={cat === 'all'} onClick={() => setCat('all')} label="All" count={products?.length || 0} />
            {categoryList.map((c) => (
              <Chip key={c.id} active={String(cat) === String(c.id)} onClick={() => setCat(c.id)} label={c.name} count={catCounts[c.id] || 0} />
            ))}
          </div>

          {/* Product area — flows in the page; no isolated scroll. */}
          <div className="-mx-1 px-1 pb-1">
          {/* grid states */}
          {productsLoading && (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 min-[760px]:grid-cols-3 min-[1100px]:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          )}

          {!productsLoading && productsError && (
            <div className="grid place-items-center rounded-[14px] border border-dashed border-[#D9CDB1] bg-white px-6 py-14 text-center">
              <p className="text-base font-bold text-[#2A2117]">Products load nahi huye</p>
              <button type="button" onClick={reload} className="mt-3 rounded-full bg-[#3A2E1F] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#4b3b28]">Dobara koshish karein</button>
            </div>
          )}

          {!productsLoading && !productsError && results.length === 0 && (
            <div className="py-14 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f0e7d4] text-[#c3b28a]"><Package size={26} weight="duotone" /></span>
              <p className="mt-3 font-bold text-[#6E6250]">{debouncedQ ? `"${debouncedQ}" ke liye koi product nahi mila` : 'Koi product nahi mila'}</p>
              <p className="mt-1 text-sm text-[#9C9078]">Search ya category badal kar dobara koshish karein.</p>
              {(debouncedQ || cat !== 'all') && (
                <button type="button" onClick={() => { setQ(''); setCat('all') }} className="mt-3 text-sm font-bold text-[#3A2E1F] underline underline-offset-2 hover:text-[#4b3b28]">Filter saaf karein</button>
              )}
            </div>
          )}

          {!productsLoading && !productsError && results.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 min-[760px]:grid-cols-3 min-[1100px]:grid-cols-4">
                {capped.map((p) => (
                  <ProductCard key={p.id} p={p} preferLargestUnit linkToProduct={false} />
                ))}
              </div>
              {results.length > GRID_CAP && (
                <p className="mt-4 text-center text-xs text-[#9C9078]">Pehle {GRID_CAP} dikhaye ({results.length} milay) — search ya category se aur filter karein.</p>
              )}
            </>
          )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Chip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-all active:scale-95 ${
        active ? 'border-[#3A2E1F] bg-[#3A2E1F] text-white' : 'border-[#D9CDB1] bg-white text-[#6E6250] hover:border-[#3A2E1F] hover:text-[#2A2117]'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-[#efe6d3] text-[#6E6250]'}`}>{count}</span>
    </button>
  )
}

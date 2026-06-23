import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Article, CalendarBlank, Newspaper, BookOpenText } from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import { getBlogs } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'
import { ErrorState, EmptyState } from '../components/ui'
import { fadeUp, stagger, viewportOnce } from '../lib/motion'

const MotionLink = motion(Link)
const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(String(d).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? String(d).slice(0, 10) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Big lead story — image + content side by side on desktop, stacked on mobile.
function FeaturedBlog({ b }) {
  return (
    <MotionLink
      to={`/blog/${b.slug}`}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className="group grid overflow-hidden rounded-[28px] border border-brand-100 bg-white shadow-soft transition-shadow hover:shadow-lift lg:grid-cols-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-sand-100 lg:aspect-auto lg:min-h-[300px]">
        {b.image_url ? (
          <img src={b.image_url} alt={b.title} loading="eager" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center text-brand-300"><Article size={48} weight="duotone" /></div>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-saffron-400 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-brand-950 shadow-soft">
          <Newspaper size={13} weight="fill" /> Featured
        </span>
      </div>
      <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400">
          <CalendarBlank size={13} weight="bold" /> {fmtDate(b.created_at)}{b.author ? ` · ${b.author}` : ''}
        </span>
        <h2 className="text-2xl font-black leading-snug tracking-tight text-brand-950 transition-colors group-hover:text-brand-700 sm:text-3xl">{b.title}</h2>
        {b.excerpt && <p className="line-clamp-3 text-[15px] leading-relaxed text-brand-600">{b.excerpt}</p>}
        <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-all group-hover:bg-brand-800">
          Poora parhein <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </MotionLink>
  )
}

function BlogCard({ b }) {
  return (
    <MotionLink
      to={`/blog/${b.slug}`}
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft transition-shadow hover:shadow-lift"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-sand-100">
        {b.image_url ? (
          <img src={b.image_url} alt={b.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
        ) : (
          <div className="grid h-full w-full place-items-center text-brand-300"><Article size={40} weight="duotone" /></div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400">
          <CalendarBlank size={13} weight="bold" /> {fmtDate(b.created_at)}{b.author ? ` · ${b.author}` : ''}
        </span>
        <h2 className="line-clamp-2 text-lg font-extrabold leading-snug text-brand-950 group-hover:text-brand-700">{b.title}</h2>
        {b.excerpt && <p className="line-clamp-3 text-sm text-brand-600">{b.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-bold text-saffron-700">
          Parhein <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </MotionLink>
  )
}

export default function BlogPage() {
  const { data, loading, error, reload } = useAsync(() => getBlogs(), [])
  const list = data || []
  const [featured, ...rest] = list

  return (
    <>
      <PageBanner
        eyebrow="Blog & Tips"
        title="England ki"
        accent="khabrein & tips"
        urdu="دکانداروں کے لیے مفید مشورے"
        desc="Products, offers aur dukaan barhane ke tareeqe — sab kuch ek hi jagah, aasaan Roman Urdu mein."
        hideCrumb
        image="/banner.jpg"
        tone="brand"
        chips={[{ icon: BookOpenText, label: 'Dukaan barhane ke tips' }, { icon: Newspaper, label: 'Nayi khabrein' }]}
      />

      <section className="container-page py-10 sm:py-14">
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
                <div className="aspect-[16/10] animate-pulse bg-sand-200" />
                <div className="space-y-2 p-5">
                  <div className="h-3 w-1/3 rounded-full bg-sand-200" />
                  <div className="h-4 w-3/4 rounded-full bg-sand-200" />
                  <div className="h-3 w-full rounded-full bg-sand-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && <ErrorState message={error.message} onRetry={reload} />}

        {!loading && !error && list.length === 0 && (
          <EmptyState icon={Article} title="Abhi koi blog nahi" text="Jald hi nayi posts yahan nazar aayengi." />
        )}

        {!loading && !error && featured && (
          <div className="flex flex-col gap-8 sm:gap-10">
            <FeaturedBlog b={featured} />
            {rest.length > 0 && (
              <motion.div variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={viewportOnce} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((b) => <BlogCard key={b.id} b={b} />)}
              </motion.div>
            )}
          </div>
        )}
      </section>
    </>
  )
}

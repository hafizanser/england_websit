import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarBlank, Article } from '@phosphor-icons/react'
import { getBlogBySlug } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'
import { ErrorState } from '../components/ui'

const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(String(d).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? String(d).slice(0, 10) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Split the stored content into paragraphs on blank/new lines.
const paragraphs = (text) =>
  String(text || '')
    .split(/\n{1,}/)
    .map((s) => s.trim())
    .filter(Boolean)

export default function BlogDetailPage() {
  const { slug } = useParams()
  const { data: b, loading, error, reload } = useAsync(() => getBlogBySlug(slug), [slug])

  return (
    <section className="container-page py-8 sm:py-12">
      <Link to="/blog" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-500 transition-colors hover:text-brand-800">
        <ArrowLeft size={16} weight="bold" /> Saare blogs
      </Link>

      {loading && (
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-4 w-32 rounded-full bg-sand-200" />
          <div className="h-9 w-3/4 rounded-xl bg-sand-200" />
          <div className="aspect-[16/9] rounded-3xl bg-sand-200" />
          <div className="h-4 w-full rounded-full bg-sand-200" />
          <div className="h-4 w-5/6 rounded-full bg-sand-200" />
        </div>
      )}

      {!loading && error && <ErrorState message={error.message} onRetry={reload} />}

      {!loading && !error && !b && (
        <div className="rounded-3xl border border-brand-100 bg-white p-12 text-center shadow-soft">
          <Article size={40} weight="duotone" className="mx-auto text-brand-300" />
          <h1 className="mt-4 text-xl font-bold text-brand-900">Blog nahi mila</h1>
          <Link to="/blog" className="mt-6 inline-flex rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800">Saare blogs dekhein</Link>
        </div>
      )}

      {!loading && !error && b && (
        <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400">
            <CalendarBlank size={14} weight="bold" /> {fmtDate(b.created_at)}{b.author ? ` · ${b.author}` : ''}
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-brand-950 sm:text-4xl">{b.title}</h1>
          {b.excerpt && <p className="mt-4 text-lg leading-relaxed text-brand-600">{b.excerpt}</p>}

          {b.image_url && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-brand-100 bg-sand-100 shadow-soft">
              <img src={b.image_url} alt={b.title} className="h-full w-full object-cover" />
            </div>
          )}

          <div className="prose-blog mt-8 space-y-5">
            {paragraphs(b.content).map((para, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-brand-700 sm:text-base">{para}</p>
            ))}
          </div>
        </motion.article>
      )}
    </section>
  )
}

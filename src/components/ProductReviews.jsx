import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatCircleText, PencilSimpleLine, CircleNotch, CheckCircle, UserCircle, Star } from '@phosphor-icons/react'
import { Stars } from './ui'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useNotify } from '../context/NotifyContext'
import { useAsync } from '../hooks/useAsync'
import { getProductReviews, submitReview } from '../api/reviews'

const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(String(d).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const avatarTints = ['from-brand-500 to-brand-700', 'from-saffron-500 to-saffron-700', 'from-emerald-500 to-emerald-700', 'from-rose-500 to-rose-700', 'from-indigo-500 to-indigo-700']
const tintFor = (name) => avatarTints[(name || 'C').charCodeAt(0) % avatarTints.length]

// Interactive star picker for the review form.
function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform active:scale-90"
        >
          <Star size={30} weight={(hover || value) >= n ? 'fill' : 'regular'} className={(hover || value) >= n ? 'text-saffron-400' : 'text-brand-200'} />
        </button>
      ))}
    </div>
  )
}

function ReviewForm({ productId, onDone }) {
  const { success, error } = useNotify()
  const { customer } = useCustomerAuth()
  const loggedInName = (customer?.name || '').trim()
  const [name, setName] = useState(loggedInName)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  const submit = async (e) => {
    e.preventDefault()
    const finalName = (loggedInName || name).trim()
    const errs = {}
    if (finalName.length < 2) errs.name = 'Apna naam likhein.'
    if (rating < 1) errs.rating = 'Star rating dein.'
    if (comment.trim().length < 3) errs.comment = 'Apni raye likhein.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await submitReview(productId, { rating, comment: comment.trim(), customer_name: finalName })
      success('Shukriya! Aapka review shaamil ho gaya.')
      setRating(0); setComment(''); if (!loggedInName) setName(''); onDone?.()
    } catch (err) {
      error(err.message || 'Review submit nahi hua.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-2 text-brand-800">
        <PencilSimpleLine size={20} weight="fill" className="text-brand-600" />
        <h3 className="text-base font-extrabold tracking-tight">Apni raye dein</h3>
      </div>
      <p className="mt-1 text-xs text-brand-500">Login ki zaroorat nahi — bas naam, rating aur apni raye likhein.</p>

      {/* Name — only asked from guests; logged-in shoppers are attributed automatically. */}
      {!loggedInName && (
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-400">Aapka naam</label>
          <div className="relative">
            <UserCircle size={18} weight="fill" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-300" />
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: undefined })) }}
              placeholder="Misaal: Bilal Kiryana Store"
              className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-3 pl-10 pr-4 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {errors.name && <p className="mt-1 text-xs font-medium text-saffron-700">{errors.name}</p>}
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-brand-400">Rating</label>
        <StarPicker value={rating} onChange={(v) => { setRating(v); setErrors((e) => ({ ...e, rating: undefined })) }} />
        {errors.rating && <p className="mt-1 text-xs font-medium text-saffron-700">{errors.rating}</p>}
      </div>

      <textarea
        value={comment}
        onChange={(e) => { setComment(e.target.value); setErrors((er) => ({ ...er, comment: undefined })) }}
        placeholder="Maal kaisa laga? Quality, rate aur delivery ke baare mein likhein…"
        className="mt-4 min-h-[96px] w-full resize-none rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
      {errors.comment && <p className="mt-1 text-xs font-medium text-saffron-700">{errors.comment}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px disabled:opacity-60"
      >
        {busy ? <CircleNotch size={18} className="animate-spin" /> : <CheckCircle size={18} weight="fill" />}
        Review submit karein
      </button>
    </form>
  )
}

export default function ProductReviews({ productId }) {
  const { data, loading, reload } = useAsync(() => getProductReviews(productId), [productId])

  const reviews = data?.reviews || []
  const summary = data?.summary || { count: 0, average: 0, breakdown: {} }
  const maxBar = Math.max(1, ...Object.values(summary.breakdown || {}))

  return (
    <div className="mt-12 sm:mt-16">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron-500 text-white">
          <ChatCircleText size={18} weight="fill" />
        </span>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">
          Reviews &amp; Ratings
          <span className="urdu mr-2 text-base font-normal text-brand-400" dir="rtl"> · گاہکوں کی رائے</span>
        </h2>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
        {/* summary + form */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-brand-100 bg-white p-6 text-center shadow-soft">
            <p className="font-display text-5xl font-black tracking-tight text-brand-900">{summary.average || '0.0'}</p>
            <div className="mt-2 flex justify-center"><Stars rating={summary.average} size={18} /></div>
            <p className="mt-1.5 text-sm text-brand-500">{summary.count} {summary.count === 1 ? 'review' : 'reviews'}</p>

            {summary.count > 0 && (
              <div className="mt-4 space-y-1.5 text-left">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="flex w-8 items-center gap-0.5 text-xs font-semibold text-brand-500">{star}<Star size={11} weight="fill" className="text-saffron-400" /></span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100">
                      <div className="h-full rounded-full bg-saffron-400" style={{ width: `${((summary.breakdown?.[star] || 0) / maxBar) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs tabular-nums text-brand-400">{summary.breakdown?.[star] || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ReviewForm productId={productId} onDone={reload} />
        </div>

        {/* list */}
        <div>
          {loading && <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center text-brand-400 shadow-soft">Load ho raha hai…</div>}

          {!loading && reviews.length === 0 && (
            <div className="grid place-items-center rounded-3xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-300"><ChatCircleText size={28} weight="duotone" /></span>
              <p className="mt-3 text-base font-bold text-brand-800">Abhi koi review nahi</p>
              <p className="mt-1 max-w-sm text-sm text-brand-500">Is product ka pehla review aap dein — apna tajurba share karein.</p>
            </div>
          )}

          {!loading && reviews.length > 0 && (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {reviews.map((r) => (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${tintFor(r.customer_name)} text-base font-extrabold text-white`}>
                        {(r.customer_name || 'C').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-brand-900">{r.customer_name}</p>
                          <span className="text-xs text-brand-400">{fmtDate(r.created_at)}</span>
                        </div>
                        <div className="mt-1"><Stars rating={r.rating} size={14} /></div>
                        <p className="mt-2 text-sm leading-relaxed text-brand-700">{r.comment}</p>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

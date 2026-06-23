import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Storefront, WarningCircle, ArrowRight, Sparkle } from '@phosphor-icons/react'
import { wholesaleBenefits } from '../data/site'
import { Eyebrow } from './ui'
import { fadeUp, stagger, spring, viewportOnce } from '../lib/motion'

function PartnerForm() {
  const [form, setForm] = useState({ shop: '', phone: '', city: '' })
  const [status, setStatus] = useState('idle') // idle | error | success
  const [error, setError] = useState('')

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (status === 'error') setStatus('idle')
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.shop.trim() || form.shop.trim().length < 3) {
      setStatus('error')
      setError('Dukaan ka naam likhein (kam az kam 3 harf).')
      return
    }
    const digits = form.phone.replace(/[^0-9]/g, '')
    if (digits.length < 10) {
      setStatus('error')
      setError('Sahi mobile number likhein, jaise 0311 2487790.')
      return
    }
    setStatus('success')
  }

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
        className="flex h-full flex-col items-center justify-center rounded-4xl border border-brand-100 bg-white p-8 text-center shadow-soft"
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
          <CheckCircle size={40} weight="fill" />
        </span>
        <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-900">
          Shukriya, {form.shop.trim().split(' ')[0]}!
        </h3>
        <p className="urdu mt-1 text-lg text-brand-600" dir="rtl">
          درخواست موصول ہو گئی
        </p>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-600">
          Hamari team 24 ghante mein aapke number par rabta karegi aur rate list bhejegi.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm({ shop: '', phone: '', city: '' })
            setStatus('idle')
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand-200 px-5 py-2.5 text-sm font-semibold text-brand-800 transition-all hover:bg-sand-50 active:translate-y-px"
        >
          Nayi dukaan add karein
        </button>
      </motion.div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="flex h-full flex-col gap-4 rounded-4xl border border-brand-100 bg-white p-6 shadow-soft sm:p-8"
    >
      <div className="flex items-center gap-2 text-brand-700">
        <Storefront size={22} weight="fill" />
        <h3 className="text-lg font-extrabold tracking-tight text-brand-900">Banein England partner</h3>
      </div>
      <p className="-mt-2 text-sm text-brand-500">
        Form bharein, foran rate list aur pehle order ki chhoot payein.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="shop" className="text-sm font-semibold text-brand-800">
          Dukaan ka naam
        </label>
        <input
          id="shop"
          type="text"
          value={form.shop}
          onChange={update('shop')}
          placeholder="Jaise: Al-Karam Karyana Store"
          className="rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-semibold text-brand-800">
            Mobile number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={form.phone}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
              setForm((f) => ({ ...f, phone: digits }))
              if (status === 'error') setStatus('idle')
            }}
            placeholder="0311 2487790"
            className="rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="city" className="text-sm font-semibold text-brand-800">
            Shehar <span className="font-normal text-brand-400">(optional)</span>
          </label>
          <input
            id="city"
            type="text"
            value={form.city}
            onChange={update('city')}
            placeholder="Karachi"
            className="rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {status === 'error' && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl bg-saffron-50 px-3 py-2 text-sm font-medium text-saffron-800"
        >
          <WarningCircle size={18} weight="fill" /> {error}
        </motion.p>
      )}

      <button
        type="submit"
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3.5 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px"
      >
        Rate list mangwayein
        <ArrowRight size={18} weight="bold" />
      </button>
      <p className="text-center text-xs text-brand-400">
        Koi minimum order nahi • Kabhi bhi cancel karein
      </p>
    </form>
  )
}

export default function WholesaleBenefits() {
  return (
    <section id="wholesale" className="container-page scroll-mt-24 py-16 sm:py-24">
      <div className="grid items-stretch gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* left */}
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="flex flex-col"
        >
          <motion.div variants={fadeUp}>
            <Eyebrow tone="saffron">Wholesale ke faide</Eyebrow>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="mt-5 text-balance text-3xl font-extrabold leading-tight tracking-tight text-brand-950 sm:text-4xl md:text-5xl"
          >
            Chhoti dukaan, <span className="text-saffron-500">bara munafa</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="urdu mt-3 text-xl text-brand-600" dir="rtl">
            تھوک کے دام، آسان شرائط
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="mt-4 max-w-lg text-[15px] leading-relaxed text-brand-700/80"
          >
            Hum samajhte hain ke har rupay ki ahmiyat hai. Isliye hamari shartein dukaandar ke
            haq mein hain — taake aapki dukaan barhe, ruke nahi.
          </motion.p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
            {wholesaleBenefits.map((b) => (
              <motion.div
                key={b.id}
                variants={fadeUp}
                className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft"
              >
                <p className="text-2xl font-black tracking-tight text-brand-800 sm:text-3xl">
                  {b.stat}
                </p>
                <p className="mt-1 text-sm font-bold text-brand-900">{b.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-brand-500">{b.note}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            variants={fadeUp}
            className="mt-4 flex items-center gap-3 rounded-3xl bg-brand-700 p-5 text-white"
          >
            <Sparkle size={24} weight="fill" className="shrink-0 text-saffron-300" />
            <p className="text-sm font-medium text-white/90">
              <span className="font-bold text-white">Bonus:</span> Har 6 mahine baad wafadar
              dukaandaron ke liye loyalty cashback.
            </p>
          </motion.div>
        </motion.div>

        {/* right — form */}
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewportOnce}>
          <PartnerForm />
        </motion.div>
      </div>
    </section>
  )
}

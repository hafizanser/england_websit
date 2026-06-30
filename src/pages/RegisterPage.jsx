import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, WarningCircle, ArrowRight, Phone, ShieldCheck } from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'
import BrandLogo from '../components/BrandLogo'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useNotify } from '../context/NotifyContext'
import { scrollBelowHeader } from '../lib/scroll'

const inputCls =
  'rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3.5 text-base text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100'

function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-brand-800">{label} {hint && <span className="font-normal text-brand-400">{hint}</span>}</span>
      {children}
      {error && <span className="flex items-center gap-1.5 text-xs font-medium text-saffron-700"><WarningCircle size={14} weight="fill" /> {error}</span>}
    </label>
  )
}

export default function RegisterPage() {
  const { phoneLogin } = useCustomerAuth()
  const { success } = useNotify()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', address: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const refs = { name: useRef(null), phone: useRef(null) }
  const formCardRef = useRef(null)

  // On arrival (e.g. via the "naya account" link on the Login page), bring the
  // register form fully into view below the sticky header — no manual scrolling.
  useEffect(() => {
    scrollBelowHeader(formCardRef.current)
  }, [])

  const update = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }
  const onPhone = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setForm((f) => ({ ...f, phone: digits }))
    setErrors((er) => ({ ...er, phone: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError('')
    const errs = {}
    if (form.name.trim().length < 3) errs.name = 'Naam likhein (kam az kam 3 harf).'
    if (form.phone.length !== 11) errs.phone = 'Mobile number 11 digit ka hona chahiye.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = ['name', 'phone'].find((k) => errs[k])
      refs[first]?.current?.focus()
      refs[first]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setBusy(true)
    try {
      const c = await phoneLogin(form)
      success(`Account ban gaya — khush aamdeed, ${c.name}!`)
      navigate('/profile')
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      setServerError(err.message || 'Register nahi ho saka.')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Account" title="Register" urdu="نیا اکاؤنٹ بنائیں" crumb="Register" />
      <section className="container-page py-12 sm:py-16">
        <div ref={formCardRef} className="mx-auto max-w-lg rounded-4xl border border-brand-100 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 border-b border-brand-100 pb-6 text-center">
            <BrandLogo tone="dark" className="h-11" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">Naya Dukaandar Account</p>
          </div>
          <div className="flex items-center gap-2 text-brand-700">
            <UserPlus size={22} weight="fill" />
            <h2 className="text-lg font-extrabold tracking-tight text-brand-900">Naya account banayein</h2>
          </div>
          <p className="mt-1 text-sm text-brand-500">Naam aur mobile number — bas itna hi. Koi password yaad rakhne ki zaroorat nahi.</p>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <Field label="Dukaandar / Dukaan ka naam" error={errors.name}>
              <input ref={refs.name} className={inputCls} value={form.name} onChange={update('name')} placeholder="Jaise: Imran Qureshi" />
            </Field>
            <Field label="Mobile number" error={errors.phone}>
              <div className="flex items-center gap-2.5 rounded-2xl border border-brand-200 bg-sand-50 px-4 transition-all focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                <Phone size={18} weight="fill" className="shrink-0 text-brand-400" />
                <input ref={refs.phone} type="tel" inputMode="numeric" autoComplete="tel" value={form.phone} onChange={onPhone} placeholder="03124361300" className="w-full bg-transparent py-3.5 text-base tracking-wide text-brand-900 outline-none placeholder:text-brand-300" />
                <span className={`shrink-0 text-xs font-bold tabular-nums ${form.phone.length === 11 ? 'text-green-600' : 'text-brand-300'}`}>{form.phone.length}/11</span>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shehar" hint="(optional)">
                <input className={inputCls} value={form.city} onChange={update('city')} placeholder="Karachi" />
              </Field>
              <Field label="Email" hint="(optional)">
                <input type="email" className={inputCls} value={form.email} onChange={update('email')} placeholder="aap@example.com" />
              </Field>
            </div>
            <Field label="Dukaan ka pata" hint="(optional)">
              <textarea className={`${inputCls} min-h-[72px] resize-none`} value={form.address} onChange={update('address')} placeholder="Shop #, market/area, shehar" />
            </Field>

            {serverError && (
              <p className="flex items-center gap-2 rounded-2xl bg-saffron-50 px-4 py-3 text-sm font-medium text-saffron-800">
                <WarningCircle size={18} weight="fill" /> {serverError}
              </p>
            )}

            <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-4 text-base font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px disabled:opacity-60">
              {busy ? 'Account ban raha hai...' : <>Account banayein <ArrowRight size={18} weight="bold" /></>}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-brand-400">
              <ShieldCheck size={14} weight="fill" /> Mobile number aapki pehchaan hai
            </p>
          </form>

          <p className="mt-5 text-center text-sm text-brand-500">
            Pehle se account hai?{' '}
            <Link to="/login" className="font-bold text-brand-700 hover:text-brand-900">Login karein</Link>
          </p>
        </div>
      </section>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SignIn, WarningCircle, ArrowRight, Phone, ShieldCheck } from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'
import BrandLogo from '../components/BrandLogo'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useNotify } from '../context/NotifyContext'
import { scrollBelowHeader } from '../lib/scroll'

const inputCls =
  'rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3.5 text-base text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100'

export default function LoginPage() {
  const { phoneLogin } = useCustomerAuth()
  const { success } = useNotify()
  const navigate = useNavigate()
  const [form, setForm] = useState({ phone: '', name: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const phoneRef = useRef(null)
  const formSectionRef = useRef(null)

  // On arrival (e.g. via the navbar Profile icon), bring the login form fully
  // into view below the sticky header — no manual scrolling needed.
  useEffect(() => {
    scrollBelowHeader(formSectionRef.current)
  }, [])

  // Phone field accepts digits only, capped at 11.
  const onPhone = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setForm((f) => ({ ...f, phone: digits }))
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.phone.length !== 11) {
      setError('Mobile number 11 digit ka hona chahiye.')
      phoneRef.current?.focus()
      phoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    try {
      const c = await phoneLogin({ phone: form.phone, name: form.name.trim() })
      success(`Khush aamdeed, ${c.name || 'dukaandar'}!`)
      navigate('/profile')
    } catch (err) {
      setError(err.message || 'Login nahi ho saka.')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Account" title="Login" urdu="موبائل نمبر سے داخل ہوں" crumb="Login" />
      <section ref={formSectionRef} className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-md rounded-4xl border border-brand-100 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 border-b border-brand-100 pb-6 text-center">
            <BrandLogo tone="dark" className="h-11" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">Dukaandar Account</p>
          </div>
          <div className="flex items-center gap-2 text-brand-700">
            <SignIn size={22} weight="fill" />
            <h2 className="text-lg font-extrabold tracking-tight text-brand-900">Mobile number se login</h2>
          </div>
          <p className="mt-1 text-sm text-brand-500">Sirf apna mobile number likhein — koi password nahi. Naya number ho to account khud ban jayega.</p>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-brand-800">Mobile number</span>
              <div className="flex items-center gap-2.5 rounded-2xl border border-brand-200 bg-sand-50 px-4 transition-all focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                <Phone size={18} weight="fill" className="shrink-0 text-brand-400" />
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={onPhone}
                  placeholder="03124361300"
                  className="w-full bg-transparent py-3.5 text-base tracking-wide text-brand-900 outline-none placeholder:text-brand-300"
                />
                <span className={`shrink-0 text-xs font-bold tabular-nums ${form.phone.length === 11 ? 'text-green-600' : 'text-brand-300'}`}>{form.phone.length}/11</span>
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-brand-800">Naam <span className="font-normal text-brand-400">(optional)</span></span>
              <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jaise: Imran Qureshi" />
            </label>

            {error && (
              <p className="flex items-center gap-2 rounded-2xl bg-saffron-50 px-4 py-3 text-sm font-medium text-saffron-800">
                <WarningCircle size={18} weight="fill" /> {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-4 text-base font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px disabled:opacity-60">
              {busy ? 'Login ho raha hai...' : <>Login / Account banayein <ArrowRight size={18} weight="bold" /></>}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-brand-400">
              <ShieldCheck size={14} weight="fill" /> Aapka number sirf order aur account ke liye
            </p>
          </form>

          <p className="mt-5 text-center text-sm text-brand-500">
            Pehli baar? Bas number daalein —{' '}
            <Link to="/register" className="font-bold text-brand-700 hover:text-brand-900">naya account</Link>
          </p>
        </div>
      </section>
    </>
  )
}

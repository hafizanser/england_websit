import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { WarningCircle, SignIn, CircleNotch } from '@phosphor-icons/react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import BrandLogo from '../../components/BrandLogo'
import { inputCls } from '../../components/admin/ui'

export default function AdminLogin() {
  const { user, loading: authLoading, login } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // After login, return to the page the user originally tried to open (preserved
  // by RequireAdmin), else the dashboard.
  const from = location.state?.from?.pathname
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : '/admin'

  // Already signed in (valid session restored on refresh) → skip the form.
  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true })
  }, [authLoading, user, from, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username.trim(), form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(
        err.code === 'NETWORK'
          ? 'Backend se rabta nahi ho saka. Apache (XAMPP) chal raha hai?'
          : err.status === 401
            ? 'Ghalat username ya password.'
            : err.message,
      )
      setLoading(false)
    }
  }

  return (
    <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-brand-950 px-4">
      {/* ambient gradient mesh */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-saffron-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-saffron-400/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandLogo tone="light" className="h-14 drop-shadow-[0_18px_40px_rgba(199,160,91,0.45)]" />
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white">Admin</h1>
          <p className="mt-1.5 text-sm text-white/45">Wholesale operations dashboard</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-4xl border border-white/10 bg-white/[0.97] p-7 shadow-lift backdrop-blur-xl sm:p-8"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-brand-800">Username</span>
            <input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className={inputCls}
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-brand-800">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className={inputCls}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="flex items-center gap-2 rounded-2xl bg-saffron-50 px-3.5 py-2.5 text-sm font-medium text-saffron-800 ring-1 ring-saffron-200">
              <WarningCircle size={18} weight="fill" className="shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3.5 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <CircleNotch size={18} className="animate-spin" /> : <SignIn size={18} weight="bold" />}
            Login
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/" className="text-sm text-white/45 transition-colors hover:text-white">
            ← Storefront par wapas
          </Link>
        </div>
      </div>
    </div>
  )
}

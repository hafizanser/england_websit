import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { WarningCircle, SignIn, CircleNotch, Eye, EyeSlash, ArrowLeft, User, Lock } from '@phosphor-icons/react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import BrandLogo from '../../components/BrandLogo'

// ===========================================================================
// Admin sign-in.
// ===========================================================================
// THE BRAND SIDE HAS TO SHOW SOMETHING.
//
// The previous two attempts both failed the same way. First it was a centred
// card floating on three blurred radial blobs, which is the stock dark-hero
// look. Then it became a split, but the left half held a small logo, one
// sentence, and about 600px of empty espresso: `justify-between` with two
// children pinned the headline to the floor and left a void in the middle. A
// brand panel with no visual in it is a placeholder, not a design.
//
// So the panel now carries the actual product range — public/hero-products.webp,
// the real England catalogue shot on its plinths. It is the right asset for
// three reasons: it is genuinely theirs rather than stock, it is already in the
// build (so an auth screen takes on no network dependency, which matters
// because this is exactly the page you land on when the backend is down), and
// it says what the dashboard behind it is for.
//
// It is anchored to the bottom and scrimmed from the top, so the copy sits on
// solid espresso while the products are lit below it. The photograph's own
// cream background becomes the warm light at the base of the panel instead of
// something that had to be fought.
//
// THE FORM SIDE STAYS ON CREAM. Dark inputs would be the more fashionable
// choice and the harder one to get to AA. White fields with a brand-600 focus
// border plus a 2px ring, and a brand-900 submit at 17.19:1, are measured.
// ===========================================================================

export default function AdminLogin() {
  const { user, loading: authLoading, login } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // After login, return to the page the user originally tried to open
  // (preserved by RequireAdmin), else the dashboard.
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

  const field =
    'w-full rounded-xl border border-brand-200 bg-white py-3 pl-11 pr-4 text-sm text-brand-900 outline-none transition-colors placeholder:text-brand-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25'
  const leadIcon = 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400'

  return (
    <div className="grid min-h-[100dvh] bg-sand-50 lg:grid-cols-[1.35fr_1fr]">
      {/* ============================== brand ============================== */}
      <div className="relative isolate flex min-h-[46vh] flex-col overflow-hidden bg-brand-950 px-6 pb-8 pt-8 sm:px-10 lg:min-h-0 lg:px-14 lg:pb-12 lg:pt-12">
        {/* The range, lit from below. `object-bottom` keeps the plinths and the
            front row in frame when the panel is cropped narrow on a laptop. */}
        <img
          src="/hero-products.webp"
          alt=""
          aria-hidden="true"
          draggable="false"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[42%] w-full select-none object-cover object-bottom opacity-[0.92] lg:h-[52%]"
        />
        {/* Scrim: opaque where the copy sits, clearing as it descends into the
            photograph. Written as an explicit three-stop gradient because the
            two-stop Tailwind utilities cannot hold the middle. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,#1a1209_0%,#1a1209_56%,rgba(26,18,9,0.9)_66%,rgba(26,18,9,0.3)_84%,rgba(26,18,9,0.55)_100%)] lg:bg-[linear-gradient(to_bottom,#1a1209_0%,#1a1209_44%,rgba(26,18,9,0.88)_56%,rgba(26,18,9,0.22)_78%,rgba(26,18,9,0.5)_100%)]"
        />
        {/* One warm wash for depth behind the wordmark. Static. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_18%_8%,rgba(199,160,91,0.26),transparent_64%)]"
        />

        <BrandLogo tone="light" className="h-12 w-fit lg:h-16" />

        <div className="mt-10 max-w-md lg:mt-14">
          <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.08] tracking-tight text-white lg:text-[3rem]">
            Wholesale operations,
            <br />
            <span className="text-saffron-300">aik jagah.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60 lg:text-[15px]">
            Orders, stock, customers aur munafa. Poora business is dashboard se chalaein.
          </p>
        </div>

        {/* Takes the remaining height so the copy stays in the scrimmed zone and
            the photograph owns the space below it. Nothing is pinned to the
            floor, which is what left the void last time. */}
        <div className="flex-1" />
      </div>

      {/* =============================== form =============================== */}
      <div className="relative flex items-center justify-center px-6 py-12 sm:px-10 lg:py-12">
        <Link
          to="/"
          className="absolute right-6 top-6 hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-brand-400 transition-colors hover:bg-white hover:text-brand-800 sm:right-10 lg:inline-flex"
        >
          <ArrowLeft size={14} weight="bold" /> Storefront
        </Link>

        <div className="w-full max-w-[380px]">
          <h2 className="font-display text-[2rem] font-extrabold leading-none tracking-tight text-brand-950">
            Sign in
          </h2>
          <p className="mt-2 text-sm text-brand-500">Admin account se login karein.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-brand-800">Username</span>
              <span className="relative block">
                <User size={17} weight="bold" className={leadIcon} />
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className={field}
                  autoComplete="username"
                  autoFocus
                />
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-brand-800">Password</span>
              <span className="relative block">
                <Lock size={17} weight="bold" className={leadIcon} />
                <input
                  type={show ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={`${field} pr-12`}
                  autoComplete="current-password"
                />
                {/* A typo in a masked field is invisible, and this form has no
                    "forgot password" to recover from one. */}
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Password chhupayein' : 'Password dikhayein'}
                  className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-brand-400 transition-colors hover:bg-sand-100 hover:text-brand-700"
                >
                  {show ? <EyeSlash size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
                </button>
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700 ring-1 ring-red-200"
              >
                <WarningCircle size={17} weight="fill" className="mt-px shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-900 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-950 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <CircleNotch size={17} className="animate-spin" /> : <SignIn size={17} weight="bold" />}
              {loading ? 'Login ho raha hai...' : 'Login'}
            </button>
          </form>

          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-400 transition-colors hover:text-brand-700 lg:hidden"
          >
            <ArrowLeft size={14} weight="bold" /> Storefront par wapas
          </Link>
        </div>
      </div>
    </div>
  )
}

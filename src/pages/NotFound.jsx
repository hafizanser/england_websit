import { Link } from 'react-router-dom'
import { Compass, ArrowRight, House } from '@phosphor-icons/react'

export default function NotFound() {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-brand-50 text-brand-400">
          <Compass size={42} weight="duotone" />
        </span>
        <p className="mt-6 text-6xl font-black tracking-tighter text-brand-200">404</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-900">
          Yeh safha nahi mila
        </h1>
        <p className="urdu mt-1 text-lg text-brand-600" dir="rtl">
          راستہ بھٹک گئے
        </p>
        <p className="mt-3 text-sm text-brand-500">
          Jo page aap dhoond rahe hain woh maujood nahi. Wapas home par chalein.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px"
          >
            <House size={17} weight="fill" /> Home
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-6 py-3 text-sm font-semibold text-brand-800 transition-all hover:bg-white"
          >
            Products dekhein <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </div>
    </section>
  )
}

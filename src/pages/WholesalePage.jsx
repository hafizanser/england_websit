import { Link } from 'react-router-dom'
import { ShoppingBagOpen, ArrowRight, WhatsappLogo, CurrencyCircleDollar, Truck, Handshake, Percent } from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import WholesaleBenefits from '../components/WholesaleBenefits'
import WhyChooseUs from '../components/WhyChooseUs'
import CitiesDelivery from '../components/CitiesDelivery'
import Faq from '../components/Faq'
import CTASection from '../components/CTASection'
import { brand } from '../data/site'

const waHref = `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}`

const heroChips = [
  { icon: Percent, label: '22% tak margin' },
  { icon: Truck, label: 'Agle din delivery' },
  { icon: Handshake, label: 'Koi minimum order nahi' },
  { icon: CurrencyCircleDollar, label: '15 din udhaar' },
]

export default function WholesalePage() {
  return (
    <>
      <PageBanner
        eyebrow="Wholesale Partnership"
        title="Dukaandar banein,"
        accent="England partner"
        urdu="تھوک کے دام، آسان شرائط"
        desc="Koi minimum order nahi, 15 din ki udhaar, 24 ghante mein delivery aur 22% tak margin. Aapki dukaan ka asli partner."
        hideCrumb
        image="/banner.jpg"
        tone="gold"
        chips={heroChips}
      >
        <div className="flex flex-wrap gap-2.5 sm:gap-3">
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#1ebe5d] active:translate-y-0"
          >
            <WhatsappLogo size={18} weight="fill" /> WhatsApp pe partner banein
          </a>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-full bg-saffron-400 px-5 py-3 text-sm font-bold text-brand-950 shadow-glow transition-all hover:-translate-y-0.5 hover:bg-saffron-300 active:translate-y-0"
          >
            <ShoppingBagOpen size={18} weight="fill" /> Rate list dekhein
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </PageBanner>

      <WholesaleBenefits />
      <WhyChooseUs />
      <CitiesDelivery />
      <Faq />
      <CTASection />
    </>
  )
}

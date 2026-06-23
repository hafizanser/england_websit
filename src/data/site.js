import {
  Scroll,
  Bug,
  Drop,
  Flame,
  Tooth,
  HandSoap,
  Plant,
  Baby,
  Scissors,
  Wind,
} from '@phosphor-icons/react'

// ---------------------------------------------------------------------------
// Brand identity
// ---------------------------------------------------------------------------
export const brand = {
  name: 'England',
  full: 'England',
  mark: 'E', // logo letter — gold-gradient square mark
  tagline: 'Har dukaan ka poora saaman',
  taglineUrdu: 'ہر دکان کا پورا سامان',
  trustUrdu: 'جس پر پورے پاکستان کا بھروسہ',
  phone: '+92 312 4361300',
  whatsapp: '+92 312 4361300',
  email: 'englandofficial590@gmail.com',
  address: 'Shah Alam Market, Lahore, Pakistan',
}

// Cart / commerce constants
export const commerce = {
  deliveryFee: 250,
  freeDeliveryOver: 5000,
  currency: 'Rs.',
}

// ---------------------------------------------------------------------------
// Trust stats
// ---------------------------------------------------------------------------
export const stats = [
  { value: '18', suffix: 'saal', label: 'Bharose ka safar', sub: '2007 se aaj tak' },
  { value: '12,400', suffix: '+', label: 'Active dukaandar', sub: 'Poore Pakistan mein' },
  { value: '47', suffix: 'shehar', label: 'Delivery network', sub: 'Roz nayi supply' },
  { value: '320', suffix: '+', label: 'SKUs stock mein', sub: '10 badi categories' },
]

// ---------------------------------------------------------------------------
// Hero slides
// ---------------------------------------------------------------------------
export const heroSlides = [
  {
    id: 'wholesale',
    kicker: 'Thok rate • Seedha factory se',
    title: 'Roz ka saaman,',
    titleAccent: 'thok ke daam par',
    urdu: 'دکان بھریں، منافع بڑھائیں',
    text: 'Tissues, soap, shampoo aur 320+ products — bina kisi minimum order ke, aapki dukaan tak.',
    primary: 'Abhi order karein',
    primaryTo: '/products',
    secondary: 'Rate list dekhein',
    secondaryTo: '/offers',
    image: 'https://picsum.photos/seed/barkat-wholesale-shelf/1280/900',
    badge: 'Free delivery 5,000+ par',
    theme: 'from-brand-800 via-brand-700 to-brand-600',
  },
  {
    id: 'baby',
    kicker: 'Naya stock • Baby Care',
    title: 'Nanha range,',
    titleAccent: 'maa ka bharosa',
    urdu: 'بچوں کی نرم دیکھ بھال',
    text: 'Diapers, baby wipes aur nipples — narm, mehfooz aur har maa ki pasand. Munafa bhi zabardast.',
    primary: 'Baby Care dekhein',
    primaryTo: '/products?cat=babycare',
    secondary: 'Sample mangwayein',
    secondaryTo: '/wholesale',
    image: 'https://picsum.photos/seed/barkat-baby-care/1280/900',
    badge: '22% tak munafa margin',
    theme: 'from-saffron-700 via-saffron-600 to-saffron-500',
  },
  {
    id: 'offer',
    kicker: 'Eid Special • Limited',
    title: 'Khushboo carton,',
    titleAccent: 'bumper discount',
    urdu: 'اگربتی پر شاندار رعایت',
    text: 'Khushboo Agarbati ke 10 carton par 1 carton bilkul free. Stock khatam hone tak.',
    primary: 'Deal pakdein',
    primaryTo: '/offers',
    secondary: 'Sharait parhein',
    secondaryTo: '/offers',
    image: 'https://picsum.photos/seed/barkat-agarbati-incense/1280/900',
    badge: '10 + 1 carton free',
    theme: 'from-brand-900 via-brand-800 to-brand-700',
  },
]

// ---------------------------------------------------------------------------
// Categories (10 business lines)
// ---------------------------------------------------------------------------
export const categories = [
  { id: 'tissues', name: 'Tissues', urdu: 'ٹشو پیپر', icon: Scroll, items: 28, seed: 'tissue-rolls-soft', tint: 'bg-brand-50 text-brand-700' },
  { id: 'mosquito', name: 'Mosquito Lotion', urdu: 'مچھر لوشن', icon: Bug, items: 14, seed: 'mosquito-repellent', tint: 'bg-saffron-50 text-saffron-700' },
  { id: 'shampoo', name: 'Shampoo', urdu: 'شیمپو', icon: Drop, items: 31, seed: 'shampoo-bottles', tint: 'bg-brand-50 text-brand-700' },
  { id: 'agarbati', name: 'Agarbati', urdu: 'اگربتی', icon: Flame, items: 19, seed: 'incense-agarbati', tint: 'bg-saffron-50 text-saffron-700' },
  { id: 'hellodr', name: 'Hello Dr Brush & Nipples', urdu: 'ٹوتھ برش و نپل', icon: Tooth, items: 22, seed: 'toothbrush-baby', tint: 'bg-brand-50 text-brand-700' },
  { id: 'soap', name: 'Soap', urdu: 'صابن', icon: HandSoap, items: 36, seed: 'soap-bars-stack', tint: 'bg-saffron-50 text-saffron-700' },
  { id: 'ispaghol', name: 'Ispaghol', urdu: 'اسپغول', icon: Plant, items: 9, seed: 'ispaghol-husk', tint: 'bg-brand-50 text-brand-700' },
  { id: 'babycare', name: 'Baby Care', urdu: 'بے بی کیئر', icon: Baby, items: 41, seed: 'baby-care-products', tint: 'bg-saffron-50 text-saffron-700' },
  { id: 'razors', name: 'Razors', urdu: 'ریزر', icon: Scissors, items: 17, seed: 'razor-shaving', tint: 'bg-brand-50 text-brand-700' },
  { id: 'haircare', name: 'Hair Care', urdu: 'ہیئر کیئر', icon: Wind, items: 26, seed: 'hair-oil-care', tint: 'bg-saffron-50 text-saffron-700' },
]

// ---------------------------------------------------------------------------
// Product catalog (acts as the "database" behind the API layer)
// ---------------------------------------------------------------------------
export const products = [
  { id: 'p1', name: 'England Soft Facial Tissue', sub: '100 pulls × 30 box carton', category: 'Tissues', categoryId: 'tissues', seed: 'soft-tissue-box', retail: 120, wholesale: 92, unit: 'box', rating: 4.8, sold: '9.2k', badge: 'Best Seller', stock: 540 },
  { id: 'p2', name: 'England Pocket Tissue 10-Pack', sub: '10 packs × 12 strip carton', category: 'Tissues', categoryId: 'tissues', seed: 'pocket-tissue-pack', retail: 150, wholesale: 112, unit: 'strip', rating: 4.6, sold: '4.1k', badge: 'Trending', stock: 320 },
  { id: 'p3', name: 'England Kitchen Towel Roll', sub: '2-ply × 24 roll carton', category: 'Tissues', categoryId: 'tissues', seed: 'kitchen-towel-roll', retail: 210, wholesale: 168, unit: 'roll', rating: 4.5, sold: '2.8k', badge: 'New', stock: 180 },

  { id: 'p4', name: 'Mahafiz Mosquito Lotion', sub: '100ml × 48 pcs carton', category: 'Mosquito Lotion', categoryId: 'mosquito', seed: 'mosquito-lotion-bottle', retail: 180, wholesale: 141, unit: 'pc', rating: 4.6, sold: '5.7k', badge: 'Season Top', stock: 410 },
  { id: 'p5', name: 'Mahafiz Mosquito Coil (10s)', sub: '10 coils × 60 pack carton', category: 'Mosquito Lotion', categoryId: 'mosquito', seed: 'mosquito-coil-pack', retail: 90, wholesale: 64, unit: 'pack', rating: 4.4, sold: '8.0k', badge: 'Best Seller', stock: 600 },

  { id: 'p6', name: 'Silkaara Anti-Hairfall Shampoo', sub: '185ml × 24 bottle carton', category: 'Shampoo', categoryId: 'shampoo', seed: 'green-shampoo-bottle', retail: 260, wholesale: 204, unit: 'bottle', rating: 4.7, sold: '7.4k', badge: 'Trending', stock: 360 },
  { id: 'p7', name: 'Silkaara Anti-Dandruff Shampoo', sub: '185ml × 24 bottle carton', category: 'Shampoo', categoryId: 'shampoo', seed: 'blue-shampoo-bottle', retail: 275, wholesale: 214, unit: 'bottle', rating: 4.6, sold: '5.2k', badge: 'New', stock: 290 },
  { id: 'p8', name: 'Silkaara Shampoo Sachet Rope', sub: '12ml × 24 sachet × 30 rope', category: 'Shampoo', categoryId: 'shampoo', seed: 'shampoo-sachet-rope', retail: 360, wholesale: 288, unit: 'rope', rating: 4.5, sold: '11.0k', badge: 'High Margin', stock: 470 },

  { id: 'p9', name: 'Khushboo Premium Agarbati', sub: 'Gulab • 12 sticks × 100 packs', category: 'Agarbati', categoryId: 'agarbati', seed: 'agarbati-incense-pack', retail: 60, wholesale: 41, unit: 'pack', rating: 4.5, sold: '11.8k', badge: '10+1 Free', stock: 900 },
  { id: 'p10', name: 'Khushboo Chandan Agarbati', sub: 'Chandan • 12 sticks × 100 packs', category: 'Agarbati', categoryId: 'agarbati', seed: 'chandan-incense-pack', retail: 65, wholesale: 45, unit: 'pack', rating: 4.6, sold: '6.9k', badge: '10+1 Free', stock: 720 },

  { id: 'p11', name: 'Hello Dr Soft Toothbrush', sub: 'Medium bristle × 144 pcs', category: 'Hello Dr Brush & Nipples', categoryId: 'hellodr', seed: 'toothbrush-colorful', retail: 110, wholesale: 79, unit: 'pc', rating: 4.7, sold: '8.5k', badge: 'Best Seller', stock: 430 },
  { id: 'p12', name: 'Hello Dr Kids Toothbrush', sub: 'Extra-soft × 144 pcs carton', category: 'Hello Dr Brush & Nipples', categoryId: 'hellodr', seed: 'kids-toothbrush', retail: 95, wholesale: 68, unit: 'pc', rating: 4.6, sold: '3.6k', badge: 'New', stock: 260 },
  { id: 'p13', name: 'Hello Dr Silicone Baby Nipple', sub: 'Anti-colic × 72 pcs carton', category: 'Hello Dr Brush & Nipples', categoryId: 'hellodr', seed: 'baby-nipple-silicone', retail: 140, wholesale: 104, unit: 'pc', rating: 4.8, sold: '4.4k', badge: 'High Margin', stock: 210 },

  { id: 'p14', name: 'Saaf Naturals Beauty Soap', sub: '130g × 72 cake carton', category: 'Soap', categoryId: 'soap', seed: 'beauty-soap-cake', retail: 95, wholesale: 68, unit: 'cake', rating: 4.9, sold: '14.1k', badge: 'Best Seller', stock: 820 },
  { id: 'p15', name: 'Saaf Antibacterial Soap', sub: '120g × 72 cake carton', category: 'Soap', categoryId: 'soap', seed: 'antibacterial-soap', retail: 105, wholesale: 76, unit: 'cake', rating: 4.7, sold: '6.6k', badge: 'Trending', stock: 540 },
  { id: 'p16', name: 'Saaf Laundry Washing Bar', sub: '250g × 48 bar carton', category: 'Soap', categoryId: 'soap', seed: 'laundry-soap-bar', retail: 70, wholesale: 49, unit: 'bar', rating: 4.5, sold: '9.9k', badge: 'High Margin', stock: 700 },

  { id: 'p17', name: 'Sehat Pure Ispaghol Husk', sub: '200g × 36 jar carton', category: 'Ispaghol', categoryId: 'ispaghol', seed: 'ispaghol-husk-jar', retail: 340, wholesale: 276, unit: 'jar', rating: 4.6, sold: '4.9k', badge: 'Pharmacy Pick', stock: 240 },
  { id: 'p18', name: 'Sehat Ispaghol Sachet Box', sub: '7g × 24 sachet × 20 box', category: 'Ispaghol', categoryId: 'ispaghol', seed: 'ispaghol-sachet-box', retail: 280, wholesale: 222, unit: 'box', rating: 4.5, sold: '3.1k', badge: 'New', stock: 190 },

  { id: 'p19', name: 'Nanha Soft-Dry Diapers (M)', sub: 'Medium × 40 pcs × 8 packs', category: 'Baby Care', categoryId: 'babycare', seed: 'baby-diaper-pack', retail: 720, wholesale: 588, unit: 'pack', rating: 4.8, sold: '6.3k', badge: 'High Margin', stock: 160 },
  { id: 'p20', name: 'Nanha Baby Wipes (72s)', sub: '72 wipes × 24 pack carton', category: 'Baby Care', categoryId: 'babycare', seed: 'baby-wipes-pack', retail: 230, wholesale: 178, unit: 'pack', rating: 4.7, sold: '7.8k', badge: 'Best Seller', stock: 380 },
  { id: 'p21', name: 'Nanha Gentle Baby Lotion', sub: '100ml × 36 bottle carton', category: 'Baby Care', categoryId: 'babycare', seed: 'baby-lotion-bottle', retail: 260, wholesale: 201, unit: 'bottle', rating: 4.6, sold: '3.9k', badge: 'Trending', stock: 220 },

  { id: 'p22', name: 'Tez Twin-Blade Razor', sub: 'Twin blade × 240 pcs carton', category: 'Razors', categoryId: 'razors', seed: 'twin-blade-razor', retail: 40, wholesale: 27, unit: 'pc', rating: 4.5, sold: '12.5k', badge: 'High Margin', stock: 950 },
  { id: 'p23', name: 'Tez Disposable Razor 5-Pack', sub: '5 pcs × 48 pack carton', category: 'Razors', categoryId: 'razors', seed: 'disposable-razor-pack', retail: 160, wholesale: 121, unit: 'pack', rating: 4.6, sold: '5.0k', badge: 'Best Seller', stock: 410 },

  { id: 'p24', name: 'Reshmi Amla Hair Oil', sub: '200ml × 24 bottle carton', category: 'Hair Care', categoryId: 'haircare', seed: 'amla-hair-oil', retail: 240, wholesale: 186, unit: 'bottle', rating: 4.7, sold: '8.1k', badge: 'Best Seller', stock: 330 },
  { id: 'p25', name: 'Reshmi Hair Cream Jar', sub: '140ml × 36 jar carton', category: 'Hair Care', categoryId: 'haircare', seed: 'hair-cream-jar', retail: 190, wholesale: 144, unit: 'jar', rating: 4.5, sold: '4.6k', badge: 'Trending', stock: 280 },
]

// IDs of the home-page "top selling" picks
export const topSellingIds = ['p1', 'p4', 'p6', 'p14', 'p19', 'p9', 'p11', 'p17']

// ---------------------------------------------------------------------------
// Offers — each carries pricing-engine metadata used by the cart
//   type: 'combo'  -> needs all productIds in cart, pct off those lines
//         'percent'-> pct off whole order if subtotal >= minSubtotal
//         'bxgy'   -> buy N get M free on the linked products
//         'shipping'-> free delivery if subtotal >= minSubtotal
// ---------------------------------------------------------------------------
export const offers = [
  {
    id: 'o-combo',
    slug: 'soap-shampoo-combo',
    type: 'combo',
    featured: 'lg',
    kicker: 'Carton Bundle',
    tag: 'Most Popular',
    title: 'Soap + Shampoo Combo',
    urdu: 'صابن اور شیمپو کارٹن ایک ساتھ — 14% بچت',
    desc: 'Saaf soap ka carton + Silkaara shampoo ka carton — ek saath len, 14% bachayein.',
    save: 'Bachat 14%',
    code: 'COMBO14',
    seed: 'soap-shampoo-combo',
    theme: 'from-brand-800 to-brand-600',
    productIds: ['p14', 'p6'],
    config: { pct: 14 },
    expiry: '30 June tak',
    terms: [
      'Dono carton cart mein hone par discount lagega.',
      'Discount sirf in do products par.',
      'Doosri offers ke sath jama nahi hoga.',
    ],
  },
  {
    id: 'o-first',
    slug: 'pehla-order-7',
    type: 'percent',
    featured: 'sm',
    kicker: 'Naya Account',
    tag: 'New Shops',
    title: 'Pehla Order 7% Off',
    urdu: 'پہلی خریداری پر 7% رعایت',
    desc: 'Nayi dukaan? Pehli khareed par foran 7% chhoot — minimum Rs.3,000.',
    save: '7% OFF',
    code: 'PEHLA7',
    seed: 'new-shop-offer',
    theme: 'from-saffron-600 to-saffron-400',
    productIds: [],
    config: { pct: 7, minSubtotal: 3000 },
    expiry: 'Hamesha (naye account)',
    terms: ['Sirf pehle order par.', 'Minimum order Rs.3,000.', 'Code: PEHLA7 apply karein.'],
  },
  {
    id: 'o-ship',
    slug: 'free-delivery-5000',
    type: 'shipping',
    featured: 'sm',
    kicker: 'Free Delivery',
    tag: '47 Cities',
    title: 'Free Delivery 5,000+ Par',
    urdu: '5,000 سے زائد آرڈر پر مفت ڈیلیوری',
    desc: '47 shehron mein Rs.5,000 se upar ke order par muft home delivery.',
    save: 'Rs.0 delivery',
    code: 'FREESHIP',
    seed: 'free-delivery-van',
    theme: 'from-brand-700 to-brand-500',
    productIds: [],
    config: { minSubtotal: 5000 },
    expiry: 'Hamesha',
    terms: ['Order Rs.5,000+ hona chahiye.', 'Apne aap apply ho jata hai.'],
  },
  {
    id: 'o-agarbati',
    slug: 'agarbati-10-plus-1',
    type: 'bxgy',
    kicker: 'Eid Special',
    tag: 'Limited',
    title: 'Khushboo Agarbati 10 + 1 Free',
    urdu: 'ہر 10 پیک پر 1 پیک بالکل مفت',
    desc: 'Khushboo Gulab agarbati ke har 10 pack par 1 pack bilkul muft.',
    save: '10 + 1 Free',
    code: 'AGAR10',
    seed: 'agarbati-incense-pack',
    theme: 'from-brand-900 to-brand-700',
    productIds: ['p9'],
    config: { buyQty: 10, freeQty: 1 },
    expiry: 'Stock khatam hone tak',
    terms: ['Sirf Khushboo Gulab Agarbati par.', 'Har 10 pack par 1 free.', 'Cart mein khud-ba-khud.'],
  },
  {
    id: 'o-baby',
    slug: 'baby-care-bundle',
    type: 'combo',
    kicker: 'Baby Care',
    tag: 'High Margin',
    title: 'Nanha Baby Bundle',
    urdu: 'بے بی بنڈل پر 12% رعایت',
    desc: 'Diapers + wipes + lotion ek saath — 12% off poore Nanha bundle par.',
    save: 'Bachat 12%',
    code: 'NANHA12',
    seed: 'baby-care-products',
    theme: 'from-saffron-700 to-saffron-500',
    productIds: ['p19', 'p20', 'p21'],
    config: { pct: 12 },
    expiry: '15 July tak',
    terms: ['Teeno Nanha products cart mein hone chahiye.', 'Discount in teen lines par.'],
  },
  {
    id: 'o-razor',
    slug: 'razor-bachat',
    type: 'percent',
    kicker: 'Bulk Bachat',
    tag: 'Bulk Deal',
    title: 'Tez Razor Bulk — 10% Off',
    urdu: 'ریزر بلک آرڈر پر 10% رعایت',
    desc: 'Rs.4,000+ ke razor order par 10% off. Mota margin, tez bikri.',
    save: '10% OFF',
    code: 'TEZ10',
    seed: 'twin-blade-razor',
    theme: 'from-brand-800 to-brand-600',
    productIds: ['p22', 'p23'],
    config: { pct: 10, minSubtotal: 4000, categoryId: 'razors' },
    expiry: '30 June tak',
    terms: ['Razor category par Rs.4,000+ order.', 'Code: TEZ10.'],
  },
]

// Quick lookup of promo codes -> offer id
export const promoCodes = offers.reduce((acc, o) => {
  if (o.code) acc[o.code.toUpperCase()] = o.id
  return acc
}, {})

// ---------------------------------------------------------------------------
// Why choose us
// ---------------------------------------------------------------------------
export const reasons = [
  { id: 'r1', title: 'Seedha factory rate', urdu: 'بیچ میں کوئی منافع خور نہیں', text: 'Koi beech ka aadmi nahi. Aapko milta hai woh rate jo wholesale market se bhi neecha hai.', icon: 'tag' },
  { id: 'r2', title: 'Agle din delivery', urdu: 'تیز اور بروقت ترسیل', text: 'Sham 6 baje tak order karein, agle kaam ke din aapki dukaan par maal hazir.', icon: 'truck' },
  { id: 'r3', title: 'Udhaar ki suhulat', urdu: 'بھروسے پر ادھار', text: 'Purane gaahkon ke liye 15 din ka credit. Aaj maal lein, baad mein hisab karein.', icon: 'handshake' },
  { id: 'r4', title: 'Asli maal, guarantee', urdu: 'سو فیصد اصل مال', text: 'Har product seal-band aur date-checked. Nakli ya expire maal ki koi gunjaish nahi.', icon: 'shield' },
  { id: 'r5', title: 'WhatsApp par order', urdu: 'ایک پیغام پر آرڈر', text: 'App ki zaroorat nahi. Photo bhejein ya list likhein — order confirm.', icon: 'chat' },
  { id: 'r6', title: 'Wapsi ki guarantee', urdu: 'نہ بکے تو واپس', text: 'Damage ya na bikne wala stock? Saadi return policy ke sath wapas karein.', icon: 'rotate' },
]

// ---------------------------------------------------------------------------
// House brands
// ---------------------------------------------------------------------------
export const houseBrands = [
  { id: 'b1', name: 'England Soft', cat: 'Tissues' },
  { id: 'b2', name: 'Mahafiz', cat: 'Mosquito Care' },
  { id: 'b3', name: 'Silkaara', cat: 'Shampoo' },
  { id: 'b4', name: 'Khushboo', cat: 'Agarbati' },
  { id: 'b5', name: 'Hello Dr', cat: 'Oral & Baby' },
  { id: 'b6', name: 'Saaf', cat: 'Soap' },
  { id: 'b7', name: 'Sehat', cat: 'Ispaghol' },
  { id: 'b8', name: 'Nanha', cat: 'Baby Care' },
  { id: 'b9', name: 'Tez', cat: 'Razors' },
  { id: 'b10', name: 'Reshmi', cat: 'Hair Care' },
]

// ---------------------------------------------------------------------------
// Wholesale benefits
// ---------------------------------------------------------------------------
export const wholesaleBenefits = [
  { id: 'w1', stat: 'Rs.0', label: 'Minimum order', note: 'Chhoti dukaan ho ya badi — koi shart nahi.' },
  { id: 'w2', stat: '15 din', label: 'Credit terms', note: 'Bharose ke gaahkon ke liye aasaan udhaar.' },
  { id: 'w3', stat: '22%', label: 'Tak munafa margin', note: 'Har carton par mota faida.' },
  { id: 'w4', stat: '24 ghante', label: 'Order se delivery', note: 'Tez supply, taake shelf khali na rahe.' },
]

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------
export const testimonials = [
  { id: 't1', name: 'Imran Qureshi', shop: 'Qureshi Karyana Store', city: 'Karachi', seed: 'shopkeeper-imran', rating: 5, text: 'Pehle main bara market jata tha, aadha din barbaad hota tha. Ab England se WhatsApp par order karta hoon, subah maal aa jata hai. Rate bhi market se kam.' },
  { id: 't2', name: 'Naila Tariq', shop: 'Tariq General Mart', city: 'Lahore', seed: 'shopkeeper-naila', rating: 5, text: 'Baby care aur soap ka margin sab se acha hai. Customer bar bar wapas aate hain kyunke maal asli hota hai. 2 saal se inhi se le rahi hoon.' },
  { id: 't3', name: 'Rafiq Memon', shop: 'Al-Memon Cash & Carry', city: 'Hyderabad', seed: 'shopkeeper-rafiq', rating: 5, text: 'Udhaar ki suhulat ne meri dukaan bachai. 15 din ka time milta hai, aaram se hisab ho jata hai. Delivery wale bhi izzat se baat karte hain.' },
  { id: 't4', name: 'Shahzad Bhatti', shop: 'Bhatti Super Store', city: 'Faisalabad', seed: 'shopkeeper-shahzad', rating: 5, text: 'Eid se pehle agarbati aur tissue ka stock kabhi khatam nahi hone diya. 10+1 wali deal mein achi bachat hui. Bharosa ban gaya hai.' },
  { id: 't5', name: 'Saima Yousuf', shop: 'New Yousuf Mart', city: 'Multan', seed: 'shopkeeper-saima', rating: 4, text: 'Shampoo aur hair oil ki range bohat achi hai. Kabhi koi cheez damage aaye to bina jhagrey wapas le lete hain. Ye baat sab se zaroori hai.' },
]

// ---------------------------------------------------------------------------
// About / company page content
// ---------------------------------------------------------------------------
export const about = {
  intro:
    'England Distributors 2007 mein ek chhoti si dukaan se shuru hua — ek hi maqsad ke sath: chhote dukaandaron ko sahi rate par asli maal pohanchana, bina kisi jhanjhat ke.',
  story: [
    'Aaj hum 47 shehron mein 12,400 se zyada dukaandaron ko supply karte hain. Lekin hamara usool wohi hai — izzat, bharosa aur sahi daam.',
    'Hamare apne 10 brands hain, jin ki quality hamare control mein hai. Isi liye hum aapko factory rate de sakte hain aur aapka margin bhi mehfooz rehta hai.',
  ],
  milestones: [
    { year: '2007', text: 'SITE Karachi mein pehla godown' },
    { year: '2013', text: '5 in-house brands launch' },
    { year: '2019', text: 'WhatsApp ordering shuru, 20 shehar' },
    { year: '2026', text: '47 shehar, 320+ SKUs, 12,400+ dukaanein' },
  ],
  values: [
    { title: 'Bharosa', text: 'Har sauda izzat aur imandari se.', icon: 'handshake' },
    { title: 'Asli maal', text: 'Seal-band, date-checked, guaranteed.', icon: 'shield' },
    { title: 'Tezi', text: '24 ghante mein delivery, kabhi shelf khali nahi.', icon: 'truck' },
  ],
}

export const faqs = [
  { q: 'Minimum order kitna hai?', a: 'Koi minimum order nahi. Chahe ek carton lein ya pachas — rate wahi rahega.' },
  { q: 'Delivery kab tak aati hai?', a: 'Sham 6 baje se pehle order par agle kaam wale din delivery. 47 shehron mein service hai.' },
  { q: 'Udhaar milta hai?', a: 'Haan, purane aur bharose-mand dukaandaron ke liye 15 din ka credit available hai.' },
  { q: 'Agar maal damage aaye to?', a: 'Damage ya expire maal ki bila-jhijhak wapsi. Hamari return policy saaf aur aasaan hai.' },
  { q: 'Order kaise karein?', a: 'WhatsApp par list bhejein, website se cart banayein, ya call karein. Teeno tareeqe chalte hain.' },
]

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
export const navLinks = [
  { to: '/categories', label: 'Categories', urdu: 'کیٹیگریز' },
  { to: '/products?view=all', label: 'Products', urdu: 'پروڈکٹس' },
  { to: '/offers', label: 'Offers', urdu: 'آفرز' },
]

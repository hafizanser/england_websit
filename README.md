# Barkat Distributors — FMCG Wholesale Platform

A premium, mobile-first React platform for an FMCG wholesale distributor, built for
small shopkeepers and retailers across Pakistan. Content uses simple roman-Urdu +
Urdu (Nastaliq) so the target audience can read it easily.

## Stack
- **React 18** + **Vite 5** + **React Router 6** (HashRouter — works in any sub-folder)
- **Tailwind CSS 3** (custom evergreen + saffron brand theme)
- **Framer Motion** (spring physics, sliders, drawers, layout transitions)
- **Phosphor Icons** (no emojis anywhere)
- A simulated **API layer** + a **cart engine** with real pricing/offers logic

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle -> dist/  (vendor-split chunks)
npm run preview  # serve the production build
```
Deploying under XAMPP? Copy `dist/` anywhere under `htdocs` — `base: './'` + HashRouter
mean deep links and refreshes work with no Apache rewrite rules.

## Pages (routes)
| Route | Page | Highlights |
|-------|------|-----------|
| `/` | **Home** | Hero slider, categories, top products, offers teaser, testimonials |
| `/products` | **Products** | Full catalog, category filter, search, sort, add-to-cart |
| `/offers` | **Offers** | Magazine banner (1 large + 2 stacked), deal cards, apply code / add bundle |
| `/wholesale` | **Wholesale** | Benefits, partner sign-up form, why-us, brands, FAQ |
| `/about` | **About** | Company story, milestones timeline, values, reviews |
| `/cart` | **Cart** | Editable line items, promo codes, totals, WhatsApp checkout |
| `*` | **404** | Friendly not-found |

## Cart & offers engine
Fully working commerce logic (no placeholders):
- **Persistent cart** — `localStorage`, survives refresh; add / qty / remove / clear.
- **Live pricing** — subtotal, retail-vs-wholesale savings, delivery, totals.
- **Offer engine** (`src/lib/cartEngine.js`) supports four offer types:
  - `combo` — % off when all bundle items are in the cart (e.g. `COMBO14`)
  - `percent` — % off the order, with optional minimum / category scope (`PEHLA7`, `TEZ10`)
  - `bxgy` — buy-X-get-Y-free, applied automatically (Khushboo agarbati 10+1)
  - `shipping` — free delivery over a threshold
- **Promo codes** validated against the live cart with clear success / error reasons.
- **WhatsApp checkout** — the cart builds a pre-filled order message to the business number.

The offer math is covered by an engine sanity test during development (combo, percent
gating, bxgy free units, delivery thresholds, invalid codes).

## "Backend" integration
`src/api/` is a service layer that returns Promises with realistic latency, so every
list exercises real **loading / error / empty** states (skeletons, retry, empty blocks).
Swap the internals of `src/api/client.js` for `fetch()` against a PHP/Node API later —
component code and the `useAsync` hook stay unchanged.

## Structure
```
src/
  api/          client.js (request simulator) + catalog.js + offers.js
  context/      CartContext.jsx (reducer + localStorage + toasts)
  lib/          cartEngine.js (pricing/offers) + motion.js (Framer presets)
  hooks/        useAsync.js (loading/error/data)
  components/   shared UI, ProductCard, Navbar, cart/CartDrawer, layout/, sections
  pages/        Home, ProductsPage, OffersPage, WholesalePage, AboutPage, CartPage
  data/site.js  all content (acts as the "database" behind the API)
```

## Customising content
Everything user-facing lives in `src/data/site.js` — products, prices, categories,
offers (with their engine config), testimonials, about copy and contact details — so
you can change the catalogue and promotions without touching components. Product/offer
imagery uses deterministic `picsum.photos` seeds; swap the `seed` values (or URLs) for
real photography before launch.

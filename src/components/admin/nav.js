import {
  Gauge,
  Receipt,
  UsersThree,
  Package,
  SquaresFour,
  Tag,
  Article,
  VideoCamera,
  ChartLineUp,
  Storefront,
  Globe,
  Star,
  FilePdf,
} from '@phosphor-icons/react'

// ---------------------------------------------------------------------------
// The admin's destinations, in one place.
// ---------------------------------------------------------------------------
// Both the sidebar and the command palette read from here, so a new screen is
// added once and is immediately reachable by click AND by keyboard. They used
// to be two lists that could drift; the palette is only trustworthy if it knows
// about everything the sidebar does.
//
// GROUPING. There were five group labels for twelve destinations, two of which
// ("General", "Finance") labelled a single item each. A heading over one row is
// not a grouping, it is a line of noise in a column that is only 264px wide. So
// Dashboard now sits ungrouped at the top where the eye lands first, and the
// rest fall into three real groups.
//
// `keywords` exist for the palette only: a shopkeeper looking for the rate list
// types "pdf" or "catalog" or "rate", not "PDF Catalog".

export const DASHBOARD = { to: '/admin', label: 'Dashboard', icon: Gauge, end: true, keywords: 'home overview summary jaiza' }

export const navGroups = [
  {
    label: 'Orders',
    items: [
      {
        to: '/admin/orders',
        label: 'All Orders',
        icon: Receipt,
        keywords: 'order sale invoice bill',
        children: [
          { to: '/admin/orders?source=admin', label: 'Dashboard Orders', icon: Storefront, keywords: 'manual counter admin order' },
          { to: '/admin/orders?source=website', label: 'Website Orders', icon: Globe, keywords: 'online web storefront order' },
        ],
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', icon: Package, keywords: 'item stock maal sku' },
      { to: '/admin/categories', label: 'Categories', icon: SquaresFour, keywords: 'category group section' },
      { to: '/admin/offers', label: 'Offers', icon: Tag, keywords: 'deal discount promo scheme' },
      { to: '/admin/blogs', label: 'Blog', icon: Article, keywords: 'post article news' },
      { to: '/admin/videos', label: 'Homepage Videos', icon: VideoCamera, keywords: 'reel clip video homepage' },
      { to: '/admin/pdf-catalog', label: 'PDF Catalog', icon: FilePdf, keywords: 'pdf rate list price catalogue download' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: UsersThree, keywords: 'customer shop dukaandaar buyer' },
      { to: '/admin/reviews', label: 'Ratings & Reviews', icon: Star, keywords: 'review rating feedback star' },
      { to: '/admin/profits', label: 'Profit Breakdown', icon: ChartLineUp, keywords: 'profit margin earning munafa' },
    ],
  },
]

/** Every destination as a flat list — what the command palette searches. */
export const allDestinations = [
  DASHBOARD,
  ...navGroups.flatMap((g) =>
    g.items.flatMap((i) => [
      { ...i, group: g.label },
      ...(i.children || []).map((c) => ({ ...c, group: i.label })),
    ]),
  ),
]

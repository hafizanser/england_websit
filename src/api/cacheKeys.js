// Cache keys for the public catalogue, in one place.
//
// Everything here is data the API serves identically to every visitor, which is
// the ONLY thing `useAsync`'s cacheKey may ever be pointed at — see the rules in
// src/lib/queryCache.js. Cart, wishlist, auth, orders, profile and every /admin
// read are deliberately absent and must stay absent.
//
// Two invariants:
//   • a key encodes every input that changes the answer (so `products` carries
//     the category, the search term and the sort);
//   • every key starts with CATALOG_PREFIX, so the admin panel can retire the
//     whole storefront cache with one `invalidateCache(CATALOG_PREFIX)` after a
//     save without having to enumerate what it just affected.

export const CATALOG_PREFIX = 'catalog:'

export const catalogKeys = {
  products: ({ cat = 'all', q = '', sort = 'popular' } = {}) =>
    `${CATALOG_PREFIX}products:${cat}:${q}:${sort}`,
  product: (id) => `${CATALOG_PREFIX}product:${id}`,
  topSelling: () => `${CATALOG_PREFIX}products:top-selling`,
  categories: () => `${CATALOG_PREFIX}categories`,
  offers: () => `${CATALOG_PREFIX}offers`,
  blogs: () => `${CATALOG_PREFIX}blogs`,
  blog: (slug) => `${CATALOG_PREFIX}blog:${slug}`,
  homepageVideos: () => `${CATALOG_PREFIX}homepage-videos`,
  productReviews: (productId) => `${CATALOG_PREFIX}reviews:product:${productId}`,
  featuredReviews: (limit) => `${CATALOG_PREFIX}reviews:featured:${limit}`,
}

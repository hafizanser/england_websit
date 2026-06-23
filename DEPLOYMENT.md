# Going Live — England Store (FMCG_project)

Deployment target: **cPanel shared hosting**, account user `codelpsc`.

| Piece | Lives at | Server folder |
|---|---|---|
| Storefront + Admin (React build) | `https://store.codelps.com` | `/home/codelpsc/store.codelps.com` |
| API (Laravel) | `https://api-store.codelps.com` | `/home/codelpsc/england_api` (docroot → `england_api/public`) |
| Database | `codelpsc_england_store` | full `order_system` schema + data |
| Product images | served by the API | `/home/codelpsc/england_api/uploads` |

> These URLs are already baked into the build and the env files. If your cPanel
> username is **not** `codelpsc`, fix the `/home/codelpsc/...` paths (in
> `backend_laravel/.env.production` → `FMCG_UPLOADS_PATH`, and in steps below).

---

## 1. Frontend build — DONE ✅

`dist/` has already been built with `VITE_API_BASE=https://api-store.codelps.com`
baked in. If you change anything, rebuild with:

```powershell
cd D:\xamp\htdocs\FMCG_project
npm run build
```

---

## 2. Create the database (cPanel)

1. **MySQL Databases** → DB `codelpsc_england_store` + user
   `codelpsc_england_store` (password `englandstore2026`) should already exist.
   If not, create them and grant the user **ALL PRIVILEGES**.
2. Export your local data:

```powershell
D:\xamp\mysql\bin\mysqldump.exe -u root order_system > D:\order_system_dump.sql
```

3. cPanel → **phpMyAdmin** → select `codelpsc_england_store` → **Import** →
   upload `order_system_dump.sql`. (If too large, gzip it and import the `.gz`.)

This gives the DB everything: `tbl_product`, `categories`, `offers`, `reviews`,
`orders`, `order_items`, `tbl_customer`, `blogs`, and the `fmcg_*` tables.

---

## 3. Create the two subdomains (cPanel → Domains/Subdomains)

1. **`store.codelps.com`** — document root `store.codelps.com`
   (`/home/codelpsc/store.codelps.com`).
2. **`api-store.codelps.com`** — document root **`england_api/public`**
   (`/home/codelpsc/england_api/public`). Create the `england_api` folder first
   if needed.
3. Set **PHP 8.2** for `api-store.codelps.com` (cPanel → *Select PHP Version* /
   *MultiPHP Manager*).

---

## 4. Upload the Laravel API (images included)

Upload the **entire contents of `backend_laravel/`** to
`/home/codelpsc/england_api/` (so `england_api/public/index.php`,
`england_api/vendor/`, and `england_api/uploads/` all exist).

- `vendor/` is prebuilt and portable — **upload it** (no Composer on the server).
- `uploads/` (≈81 MB, 96 images — curated to only the files the catalogue
  actually references, plus the logo/banner/favicon) is **already bundled inside
  `backend_laravel/`** and matches `FMCG_UPLOADS_PATH`. New admin uploads land here.
- Tip: zip `backend_laravel`, upload the single zip, *Extract* in File Manager —
  far faster than FTP-ing thousands of files. Skip `.git`.

Then:

1. Rename/copy `england_api/.env.production` → **`england_api/.env`**
   (File Manager → Settings → *Show Hidden Files* to see dotfiles).
2. Permissions — `storage/`, `bootstrap/cache/` (and `uploads/` for new
   uploads) must be writable:

```bash
chmod -R 775 storage bootstrap/cache uploads
```

> Storefront logo, banner, and favicon are static frontend assets — they're
> already inside the `dist/` build (step 7), nothing extra to do.

---

## 5. Initialise the app (cPanel → Terminal, or SSH)

```bash
cd ~/england_api
php artisan migrate --force       # creates any missing fmcg_* tables (idempotent)
php artisan fmcg:migrate-legacy   # seeds admin login + copies legacy rows
php artisan config:cache
php artisan route:cache
```

No terminal? The imported dump (step 2) already contains the `fmcg_*` tables and
admin row, so you can skip these — just delete `bootstrap/cache/*.php` if a
stale cache causes errors.

---

## 6. Upload the frontend

Upload the **contents of `dist/`** (not the folder) into
`/home/codelpsc/store.codelps.com/` so that `store.codelps.com/index.html`
exists.

The app uses **HashRouter** + relative asset paths, so deep links and refreshes
work with no `.htaccess` rewrites.

---

## 7. Go live & verify

1. Enable **SSL** (cPanel → *SSL/TLS Status* → AutoSSL) for both subdomains.
2. Test the API in a browser:
   - `https://api-store.codelps.com/products` → JSON products
   - `https://api-store.codelps.com/categories` → JSON categories
   - `https://api-store.codelps.com/image?file=<an-image-name>` → an image
3. Open `https://store.codelps.com` → storefront loads with products + images.
4. Admin: `https://store.codelps.com/#/admin` → login `admin` / `admin123`,
   then change the password (Security below).

---

## Security checklist

- [ ] `APP_DEBUG=false`, `APP_ENV=production` (set in `.env.production`).
- [ ] `CORS_ALLOWED_ORIGINS=https://store.codelps.com` (already set).
- [ ] Change admin password: set `FMCG_ADMIN_PASSWORD` in `.env`, then
      `php artisan fmcg:migrate-legacy` + `php artisan config:cache`.
- [ ] Change `FMCG_PROFIT_PIN` from default `2244`.
- [ ] `.env` sits above `public/`, so it is not web-accessible. ✅

---

## Choosing your URLs (important)

This build assumes the **subdomain** layout above (`store.codelps.com` +
`api-store.codelps.com`). The API URL is controlled by **one value in three
places** — change all three and rebuild if your real URLs differ:

1. `.env.production` (root) → `VITE_API_BASE`
2. `backend_laravel/.env.production` → `APP_URL`
3. `backend_laravel/.env.production` → `CORS_ALLOWED_ORIGINS` (your storefront origin)

Then `npm run build` again. (A subfolder like `codelps.com/england_store/api`
also works because the app uses HashRouter + relative assets — just set the three
values to that URL.)

## What changed in the repo to make this deploy-ready

- **`src/api/http.js`** — the API base now reads `VITE_API_BASE` from the env
  (was a hardcoded wrong URL, which broke ALL data loading: featured products,
  products, categories, images). This is the core fix.
- **Image fallbacks** — `src/lib/img.js` + a bundled `public/placeholder.svg`;
  every product/category/offer/cart image now has an `onError` fallback, so a
  missing file shows a clean placeholder instead of a broken-image icon (no more
  external `picsum.photos` dependency on real-data images).
- `backend_laravel/config/cors.php` — now **fails closed** in production (no `*`
  wildcard fallback if `CORS_ALLOWED_ORIGINS` is blank).
- Backend hardening — review-status enum whitelist (`ReviewRepo`), image-only
  upload extension allow-list (`Uploads::save`), and a DB transaction around
  checkout (`OrderService`) so a half-written order can never persist.
- `.env.production` (root + backend) — frontend → `https://api-store.codelps.com`;
  backend production env with `APP_DEBUG=false`, cPanel DB creds, CORS locked.
- `backend_laravel/.env` — restored to **local-dev** values (local `order_system`
  DB, `localhost:8000`) so the app runs locally; production values stay in
  `.env.production`.
- `dist/` — rebuilt with the live API URL + the image placeholder.

## Known items needing your decision (not blockers for browsing the store)

- **Admin order list source.** Admin order pages read the legacy `orders` table
  (the order_management wholesale orders), while storefront checkout writes to
  `fmcg_orders`. So storefront customer orders don't appear in the admin order
  list today. Decide whether the admin should show storefront orders, wholesale
  orders, or both (unified) — this is a deliberate two-app design, so it was left
  as-is rather than rewritten blindly.
- **Promo codes** entered at checkout are validated by the API but the cart’s
  discount math still references the bundled sample offers in `src/data/site.js`,
  so admin-created promo codes won’t compute a discount. Wire the cart engine to
  the live offers if you rely on promo codes (most ordering funnels to WhatsApp).
- **Product #32 “England Mystick Aura”** has no surviving image file (its 3 image
  refs were deleted long ago) — re-upload a photo via Admin → Products. It shows
  the placeholder until then.

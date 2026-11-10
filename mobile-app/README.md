# England Orders — Android app

Internal order desk for the England team: today's / tomorrow's / previous orders, order details,
Pandi & Adda names, delivery date, and Pandi slip photos saved on the server against the exact order.

- **Stack:** React 19 + Vite 7, Capacitor 6 (Android). Package id `com.englandbymt.orders`.
- **Backend:** the England Laravel API in `../backend_laravel` (new `/app/*` routes, see below).
  The website and its database stay the source of truth; the app never writes to `fmcg_orders`.

## Folders

```
mobile-app/
  src/            React screens (Login, Orders, OrderDetail), lib (api, image, native), state, styles
  public/         England icons
  android/        Capacitor Android project (icons, splash, permissions, signing gate)
  .env.android    API used by Android builds (live: https://englandwaly.com/api)
```

## Run in a browser (development)

```
npm install
copy .env.example .env.local      # VITE_API_BASE=http://127.0.0.1:8010
npm run dev                       # http://127.0.0.1:5180
```
The backend must allow the dev origin in `CORS_ALLOWED_ORIGINS`.

## Build the Android APK (no Android Studio)

Needs JDK 17 and the Android SDK (same toolchain as the Masoom app: `%USERPROFILE%\AndroidTools`).

```
npm run android:sync              # vite build --mode android + cap sync android
cd android
gradlew.bat assembleDebug         # -> android\app\build\outputs\apk\debug\app-debug.apk
```

`vite.config.js` refuses an Android build whose `VITE_API_BASE` is empty, `localhost` or `127.0.0.1`.
To point a test build at another server (e.g. a PC on the same Wi-Fi), put
`VITE_API_BASE=...` in `.env.android.local` (git-ignored).

### Signed release

Release signing is used only when `android/keystore.properties` exists (git-ignored):

```
storeFile=C:/path/to/england-orders.jks
storePassword=...
keyAlias=...
keyPassword=...
```
then `gradlew.bat assembleRelease`. Without it, only the debug APK is built.

## Backend API (Laravel, `backend_laravel`)

All routes need an England **admin** token (Sanctum, token name `england-orders-app`),
except login. The token is kept in Capacitor Preferences on the phone (app data, backups disabled).

| Method | Path | Purpose |
|---|---|---|
| POST | `/app/auth/login` | username + password → token (throttled 10/min) |
| POST | `/app/auth/logout` | revoke this token |
| GET | `/app/auth/me` | current admin |
| GET | `/app/orders?tab=today\|tomorrow\|previous\|all&q=&status=&slip=&from=&to=&page=&per_page=` | cards + counts per tab |
| GET | `/app/orders/{id}` | full order (customer, items, totals, delivery, slip) |
| PATCH | `/app/orders/{id}/delivery` | `order_code`, `delivery_date`, `pandi_name`, `adda_name` |
| POST | `/app/orders/{id}/slip` | multipart `order_code` + `slip` (jpeg/png/webp ≤ 10 MB) |
| GET | `/app/orders/{id}/slip` | the slip photo (private, authenticated) |

- New table `fmcg_order_deliveries` (one row per order: delivery date, Pandi, Adda, slip metadata).
- Slip files: `storage/app/pandi-slips/{order_id}/…` (not public). `FMCG_SLIPS_PATH` overrides it.
- An upload must carry the order's code; a mismatch is refused (409), so a slip can never land on another order.
- Day boundaries use `FMCG_BUSINESS_TIMEZONE` (default `Asia/Karachi`).
- Uploading a slip or editing delivery fields never changes the order's status, items, totals or stock.

### Going live (not done — needs approval)

1. Upload the backend files and run `php artisan migrate` (adds only `fmcg_order_deliveries`).
2. Add the app origin `https://localhost` to `CORS_ALLOWED_ORIGINS`.
3. Make sure `storage/app/pandi-slips` is writable.

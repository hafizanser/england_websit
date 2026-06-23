# Barkat Distributors — Full-Stack Setup

A React storefront + admin dashboard backed by a **PHP (MVC) + SQLite** API.
Everything runs on XAMPP with no database server configuration (SQLite is a file).

## 1. Backend (PHP + SQLite)

The API lives in `backend/`. It needs PHP 8 with `pdo_sqlite` (bundled with XAMPP).
The SQLite database (`backend/database/data.sqlite`) is **created and seeded
automatically** on the first request — products, categories, offers and an admin
user are inserted.

Pick **one** way to serve it:

**A) XAMPP Apache (production-style)**
- Make sure Apache's DocumentRoot serves `D:\xamp\htdocs` (the default for XAMPP).
- The frontend calls `http://localhost/FMCG_project/backend/public/index.php` by
  default — this works with **or without** `mod_rewrite`.

**B) PHP built-in server (easiest for development)**
```bash
php -S localhost:8000 -t backend/public backend/public/index.php
```
Then create `.env` (copy `.env.example`) with:
```
VITE_API_BASE=http://localhost:8000
```

Verify the API:
```bash
curl http://localhost:8000/categories        # built-in server
# or
curl http://localhost/FMCG_project/backend/public/index.php/categories   # Apache
```

## 2. Frontend (React + Vite)
```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production bundle -> dist/
npm run preview
```
If you build for Apache, copy `dist/` somewhere under `htdocs` and keep the
`backend/` folder reachable at the URL in your `.env` / the default above.

## 3. Admin dashboard
- URL: `/#/admin`  (e.g. `http://localhost:5173/#/admin`)
- Default login: **admin / admin123**  (change in `backend/config/config.php`
  before the first run, or update the seeded user).
- Sections: Dashboard (reporting), Orders, Customers, Products, Categories, Offers.

## 4. Key flows
- **Checkout** (`/#/checkout`) — guest checkout; a customer account is created /
  linked automatically from the form (matched by phone). No delivery charges.
- **Order history** (`/#/orders`) — customer enters their phone to see all orders,
  statuses and invoices.
- **Invoice** (`/#/order/BD-1001`) — Print, download **PDF**, and share an order
  summary **PNG** via WhatsApp (Web Share API on mobile, download + chat fallback).
- **Admin order detail** — change status (with history) and apply **per-product
  discounts**; discounts flow through to the customer view, invoice and PDF.

## Architecture (MVC)
```
backend/
  public/index.php            front controller
  app/Core/                   Router, Request, Response, App, Database, Model, Controller
  app/Models/                 Product, Category, Offer, Customer, Order, OrderItem, User
  app/Services/               PricingService, OrderService, AuthService
  app/Controllers/            Catalog, Checkout, Order, Auth  (+ Admin/* controllers)
  app/Routes/api.php          route table
  database/schema.sql + data.php + Seeder
src/                          React Views/Components, contexts, api client, pages, admin/
```
Pricing is authoritative on the server (`PricingService` mirrors the client cart
engine) so order totals can't be tampered with from the browser.

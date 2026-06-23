-- Barkat Distributors — SQLite schema (idempotent)

CREATE TABLE IF NOT EXISTS categories (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    urdu  TEXT,
    items INTEGER DEFAULT 0,
    seed  TEXT,
    tint  TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    sub         TEXT,
    category    TEXT,
    category_id TEXT,
    seed        TEXT,
    retail      INTEGER NOT NULL DEFAULT 0,
    wholesale   INTEGER NOT NULL DEFAULT 0,
    unit        TEXT DEFAULT 'pc',
    rating      REAL DEFAULT 4.5,
    sold        TEXT DEFAULT '0',
    badge       TEXT,
    stock       INTEGER DEFAULT 0,
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
    id          TEXT PRIMARY KEY,
    slug        TEXT UNIQUE,
    type        TEXT NOT NULL,
    kicker      TEXT,
    tag         TEXT,
    title       TEXT NOT NULL,
    description TEXT,
    save_label  TEXT,
    code        TEXT,
    seed        TEXT,
    theme       TEXT,
    featured    TEXT,
    product_ids TEXT,   -- JSON array
    config      TEXT,   -- JSON object
    expiry      TEXT,
    terms       TEXT,   -- JSON array
    active      INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,
    email         TEXT,
    address       TEXT,
    city          TEXT,
    password_hash TEXT,
    token         TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    code           TEXT NOT NULL UNIQUE,
    customer_id    INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    subtotal       INTEGER NOT NULL DEFAULT 0,
    promo_discount INTEGER NOT NULL DEFAULT 0,
    item_discount  INTEGER NOT NULL DEFAULT 0,
    delivery       INTEGER NOT NULL DEFAULT 0,
    total          INTEGER NOT NULL DEFAULT 0,
    promo_code     TEXT,
    discount_lines TEXT,  -- JSON array of {label, amount}
    source         TEXT NOT NULL DEFAULT 'website',  -- website | admin
    note           TEXT,
    placed_at      TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      INTEGER NOT NULL,
    product_id    TEXT,
    name          TEXT NOT NULL,
    sub           TEXT,
    unit          TEXT,
    seed          TEXT,
    qty           INTEGER NOT NULL DEFAULT 1,
    unit_price    INTEGER NOT NULL DEFAULT 0,
    line_total    INTEGER NOT NULL DEFAULT 0,
    discount      INTEGER NOT NULL DEFAULT 0,
    discount_note TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL,
    status     TEXT NOT NULL,
    note       TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin',
    token         TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blogs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    excerpt    TEXT,
    content    TEXT,
    image      TEXT,
    author     TEXT DEFAULT 'England',
    status     TEXT NOT NULL DEFAULT 'published',  -- published | draft
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Per-customer saved cart — persists the shopper's basket across devices/logins
-- until they manually clear it. `rows` is the same JSON the storefront stores.
CREATE TABLE IF NOT EXISTS carts (
    customer_id INTEGER PRIMARY KEY,
    rows        TEXT NOT NULL DEFAULT '[]',  -- JSON array of cart rows
    code        TEXT,
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);

# PromoStore — Ecommerce Storefront + Promotion Engine

A full-stack ecommerce application whose primary feature is a robust, transactionally-safe
**promotion/coupon engine**, wired into a realistic shopping and checkout flow. Built as a
customer storefront plus an admin promotion dashboard, backed by PostgreSQL.

## 1. Project overview

- **Customers** browse products, filter by category, manage a cart, apply/remove coupons,
  check out with a simulated payment step, and view their order history.
- **Admins** manage promotions (create/edit/pause/activate), see real dashboard metrics, and
  view read-only product/category catalogs.
- The backend is **authoritative for all pricing**. The frontend never computes a discount —
  it only collects input, calls the API, and renders what the API returns.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, React Router 6, Tailwind CSS, plain JavaScript (JSX) |
| Backend | Node.js, Express |
| Database | PostgreSQL (mandatory — no Mongo) |
| ORM | Prisma |
| Auth | JWT (stateless), bcrypt password hashing |
| Money | PostgreSQL `NUMERIC(12,2)`, `decimal.js` in application code — never native floats |
| Testing | Jest + Supertest (unit tests for the engines, integration tests against a real Postgres test DB) |

## 3. Architecture

```
React UI  →  Express API  →  Business Logic (services)
                                   │
                         ┌─────────┴─────────┐
                         ▼                   ▼
                 Promotion Engine     Auth / RBAC middleware
                         │
                 Pricing Engine
                         │
                    PostgreSQL
```

Pipeline for every priced cart/checkout:

```
Promotion Rules → Promotion Evaluation → Eligible Cart Items
                → Pricing Calculation → Checkout Validation
                → Redemption + Order Transaction
```

`server/src/promotions/promotionEngine.js` and `server/src/pricing/pricingEngine.js` are pure,
DB-independent modules — they take plain JS objects/Decimals in and return plain
objects/Decimals out. This is what makes them unit-testable without a database (see
`server/tests/promotionEngine.test.js` and `pricingEngine.test.js`) and keeps "does this
promotion apply?" (promotion engine) cleanly separate from "how much discount?" (pricing engine).

### Project layout

```
client/           React app (Vite + Tailwind)
  src/
    components/   Shared UI (ProductCard, PromotionForm, ProtectedRoute, ...)
    context/      AuthContext, CartContext
    layouts/      CustomerLayout, AdminLayout
    pages/
      auth/       SignIn, SignUp
      customer/   Products, ProductDetail, Categories, Cart, Checkout, Orders
      admin/      Dashboard, Promotions list/create/detail, Products, Categories
    services/     api.js (fetch wrapper)
    utils/        format.js (money/date display)

server/
  prisma/         schema.prisma, hand-authored SQL migration, seed.js
  src/
    auth/         signup/login/JWT
    products/ categories/   read-only catalog
    carts/         cart CRUD + coupon apply/remove + pricing
    promotions/    promotionEngine.js (pure), promotions.service.js (DB-backed evaluation)
    pricing/       pricingEngine.js (pure)
    orders/        orders.service.js — the transactional checkout
    admin/         promotion CRUD, dashboard metrics
    middleware/    authenticate, requireRole, centralized error handler
    utils/         AppError, money (Decimal helpers), logger
  tests/           Jest unit + integration suites
```

## 4. Database schema & relationships

```
User 1─1 Cart 1─* CartItem *─1 Product *─1 Category
User 1─* Order 1─* OrderItem
User 1─* Redemption *─1 Promotion *─* Category (via PromotionCategory)
Order 1─1 Redemption (a redemption is always tied to the order it paid for)
```

Key tables: `users`, `categories`, `products`, `carts`, `cart_items`, `promotions`,
`promotion_categories`, `redemptions`, `orders`, `order_items`, `idempotency_keys`.

The database enforces invariants beyond application code via `CHECK` constraints (see
`server/prisma/migrations/000001_init/migration.sql`): positive prices, non-negative stock,
percentage discounts clamped to 0–100, non-negative usage limits, `end_at > start_at`,
non-negative order/line totals, unique emails/SKUs/coupon codes, etc.

**Historical integrity**: `order_items` stores a full snapshot (`productName`, `sku`,
`categoryName`, `unitPrice`, `discount`, `finalPrice`) and `redemptions` stores a snapshot of
the promotion at redemption time (`couponCode`, `discountType`, `discountValue`,
`discountAmount`). Editing a promotion or changing a product's price later never alters past
orders.

## 5. Authentication & roles

- `POST /api/v1/auth/signup` — always creates `role = USER`. There is no client-facing way to
  become `ADMIN`; the only admin account is created by the seed script.
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me` — JWT bearer auth (`Authorization: Bearer <token>`).
- Middleware: `authenticate` (valid JWT → `req.user`) and `requireRole('ADMIN')`. All
  `/api/v1/admin/*` routes require both.
- **Ownership is checked independently of role.** `GET /api/v1/orders/:id` and cart routes
  compare `resource.userId` against `req.user.id` (derived from the JWT, never trusted from
  the URL/body) — a `USER` gets `403 CART_ACCESS_DENIED` / `403 ORDER_ACCESS_DENIED` when
  touching someone else's resource, and admins do **not** get implicit access to customer
  carts/orders.

## 6. Promotion engine

`promotionEngine.evaluatePromotion(promotion, { cartItems, now, userRedemptionCount })` answers
one question — *does this promotion apply, and to what?* — and returns either:

```js
{ ok: true, promotion, eligibleItems, eligibleSubtotal, cartSubtotal }
// or
{ ok: false, code: "MIN_ORDER_VALUE_NOT_MET", message: "...", data: { ... } }
```

Checks, in order: promotion exists → `status === ACTIVE` → `now` within `[startAt, endAt]` →
category eligibility (at least one eligible line) → **minimum order value, evaluated against
the eligible subtotal** (so an all-category coupon checks the full cart, a category-restricted
coupon checks only that category's subtotal) → per-user usage limit → total usage limit.

Machine-readable error codes: `PROMOTION_NOT_FOUND`, `PROMOTION_INACTIVE`,
`PROMOTION_NOT_STARTED`, `PROMOTION_EXPIRED`, `NO_ELIGIBLE_ITEMS`, `MIN_ORDER_VALUE_NOT_MET`
(with `{ minimumOrderValue, currentSubtotal, shortfall }`), `CUSTOMER_LIMIT_REACHED`,
`TOTAL_USAGE_LIMIT_REACHED`, `CART_ACCESS_DENIED`, `PRODUCT_OUT_OF_STOCK`, etc.

### Pricing engine

`pricingEngine.calculatePricing(cartItems, promotionEvaluation)` takes the (successful)
evaluation above and computes the money:

- Percentage: `raw = eligibleSubtotal × value / 100`; Flat: `raw = value`.
- `discount = min(raw, eligibleSubtotal, maximumDiscount ?? raw)`, clamped to `>= 0`.
- `total = max(subtotal - discount, 0)`.
- The discount is then **allocated proportionally** across eligible line items by each line's
  share of the eligible subtotal, with the last eligible line absorbing the rounding remainder
  so allocations always sum exactly to the total discount. Excluded-category lines get `0`.

Both engines are pure functions with no DB/HTTP dependency — see `server/tests/*.test.js` for
~20 unit tests covering category eligibility, min-order-against-eligible-subtotal, percentage/flat/cap
math, allocation-sums-exactly, and the `discount ≤ eligibleSubtotal` / `total ≥ 0` invariants.

## 7. Coupon lifecycle: Apply vs. Redeem

- **Apply** (`POST /carts/:id/coupons`) only *evaluates* the promotion and, if valid, stores the
  code on the cart. It never increments usage or creates a redemption.
- **Redeem** happens only inside the checkout transaction, only when payment succeeds and the
  order is created. See `server/src/orders/orders.service.js`.
- Coupon `apply`/`remove` and `GET /carts/:id/pricing` always **re-evaluate live** — if the cart
  contents change, or the coupon expires between requests, pricing recalculates from scratch on
  every read.

## 8. Checkout, simulated payment, and transactions

`POST /api/v1/orders/checkout` never trusts previously-displayed pricing. On every call it:
loads the current cart → re-validates every product (active, category active, sufficient
stock) → recalculates the subtotal → re-evaluates the coupon (if any) → then branches:

- **`paymentOutcome: "FAILED"`** — simulated failure. No DB writes beyond an idempotency
  record. Cart, coupon, stock, and usage are all untouched.
- **`paymentOutcome: "SUCCESS"`** — a single Prisma `$transaction` that: `SELECT ... FOR UPDATE`
  locks the promotion row (if a coupon is applied) → re-validates the promotion against the
  locked, up-to-date usage counters → atomically reserves stock per line via
  `UPDATE products SET stock = stock - qty WHERE stock >= qty` (0 rows updated ⇒
  `PRODUCT_OUT_OF_STOCK`, transaction rolls back) → creates the `Order` + `OrderItem` snapshot
  rows → increments `promotion.currentUsage` and creates the `Redemption` snapshot → clears the
  cart (`cart_items` deleted, `coupon_code` reset to `NULL`) → commits. Any thrown error rolls
  back the entire transaction — no partial order/redemption is ever left behind.

There are exactly two payment buttons on `/checkout` — **Payment Failed** and **Pay & Place
Order** — no real payment gateway is integrated and no card/UPI/bank details are collected.

### Concurrency

The `FOR UPDATE` lock on the promotion row means two simultaneous checkouts against the same
coupon serialize: the second transaction blocks until the first commits or rolls back, then
re-reads the (now up-to-date) usage counters before deciding. This is exercised directly in
`server/tests/checkout.integration.test.js` — *"concurrent checkouts by different users against
a coupon with 1 remaining use: exactly one succeeds"* — by firing two real concurrent HTTP
requests at a running server against a coupon with `totalUsageLimit: 1` and asserting exactly
one `201`, one `TOTAL_USAGE_LIMIT_REACHED`, and `currentUsage === 1` / one `Redemption` row
afterward. The same `UPDATE ... WHERE stock >= qty` pattern protects stock from oversell.

### Idempotency

`POST /orders/checkout` accepts an `idempotencyKey`. The server first tries to `INSERT` a row
into `idempotency_keys` with that key as a `UNIQUE` column, *outside* the main transaction —
this acts as a claim: a concurrent/duplicate request with the same key either sees the claim
row already committed (and replays the cached response) or gets a `409 DUPLICATE_REQUEST` while
the first request is still in flight. On a genuine business-validation failure the claim is
released so the same key can be retried once the underlying issue is fixed. The client
generates a fresh UUID per checkout attempt (`CheckoutPage.jsx`) and reuses it across retries of
that same attempt (e.g. an accidental double-click), so **frontend button-disabling is a UX nicety,
not the source of correctness** — the guarantee lives server-side.

## 9. Money handling

All authoritative money math happens in `server/src/utils/money.js`, backed by `decimal.js`.
Database columns are `NUMERIC(12,2)`. The API always serializes money as fixed 2-decimal
**strings** (e.g. `"499.00"`), never floats, so clients can't accidentally do float arithmetic
on them either.

## 10. API reference

All routes are under `/api/v1`. Authenticated routes expect `Authorization: Bearer <token>`.

```
POST   /auth/signup                         POST   /auth/login              GET /auth/me

GET    /categories                          GET    /products                GET /products/:id

GET    /carts/me                            GET    /carts/:id
POST   /carts/:id/items                     PATCH  /carts/:id/items/:itemId  DELETE /carts/:id/items/:itemId
POST   /carts/:id/coupons                   DELETE /carts/:id/coupons/:code  GET /carts/:id/pricing

POST   /orders/checkout                     GET    /orders                  GET /orders/:id

GET    /admin/dashboard
GET    /admin/promotions                    GET    /admin/promotions/:id
POST   /admin/promotions                    PATCH  /admin/promotions/:id
POST   /admin/promotions/:id/pause          POST   /admin/promotions/:id/activate
GET    /admin/categories                    GET    /admin/products
```

Errors are always `{ "error": { "code": "...", "message": "...", "data"?: {...} } }` with an
appropriate HTTP status (`400/401/403/404/409/422/500`) via a centralized error handler —
stack traces and raw DB errors are never sent to clients.

## 11. Logging

Structured JSON events to stdout (`server/src/utils/logger.js`): `auth.signup.success`,
`auth.login.success`, `coupon.apply.success/rejected`, `coupon.redeem.success`,
`promotion.created/updated/paused/activated`, `order.created/failed`,
`payment.simulated.success/failure`, etc. Passwords, JWTs, and other secrets are never logged.

## 12. Environment variables

**`server/.env`** (copy from `server/.env.example`):

```
DATABASE_URL="postgresql://promo:promo@localhost:5432/promo_db?schema=public"
JWT_SECRET="change-this-to-a-long-random-secret-in-production"
JWT_EXPIRES_IN="7d"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
ADMIN_EMAIL="admin@promo.test"
ADMIN_PASSWORD="Admin@12345"
ADMIN_NAME="Store Admin"
```

**`client/.env`** (copy from `client/.env.example`):

```
VITE_API_URL=http://localhost:4000/api/v1
```

## 13. Running locally

### Setting up the database

Two ways to create the schema — pick whichever fits:

- **Via Prisma** (`npm run migrate` in `server/`, shown below) — applies
  `server/prisma/migrations/000001_init/migration.sql` and tracks migration history. Use this
  if you have Node installed and plan to run the app normally.
- **Via raw SQL** (`server/prisma/schema.sql`) — a plain schema-only `pg_dump` of the same
  schema, with no Prisma/Node dependency at all:
  ```bash
  createdb promo_db
  psql -d promo_db -f server/prisma/schema.sql
  ```
  Useful for bootstrapping a database on a machine before Node is set up, or handing the schema
  to someone who just wants `psql`. Either path produces an identical schema; from there, `npm
  run seed` works the same way regardless of which one you used.
- **Schema + data** (`server/prisma/schema_data.sql`) — same as above but also carries every
  row (categories, products, promotions, accounts, any orders placed locally), so it clones the
  database exactly rather than giving you a fresh empty one:
  ```bash
  createdb promo_db
  psql -d promo_db -f server/prisma/schema_data.sql
  ```
  Password hashes travel as bcrypt hashes, not plaintext, so existing accounts keep working
  with their original password. Regenerate this file with `pg_dump` whenever you want an
  up-to-date snapshot — it's a point-in-time export, not kept automatically in sync.

### Option A — Docker for Postgres only

```bash
docker compose up -d          # starts Postgres on localhost:5432 (user/pass/db: promo/promo/promo_db)
```

### Option B — your own local PostgreSQL

Create a `promo` role and `promo_db` database and point `DATABASE_URL` at it.

### Then, in two terminals:

```bash
# Terminal 1 — API (http://localhost:4000)
cd server
npm install
cp .env.example .env          # adjust if needed
npm run migrate                # applies the SQL migration
npm run seed                   # categories, ~19 products, SAVE20/TECH20/FLAT100/EXPIRED20, admin account
npm run dev

# Terminal 2 — Web app (http://localhost:5173)
cd client
npm install
cp .env.example .env
npm run dev
```

Sign up as a new customer at `/signup`, or sign in as the seeded admin printed by the seed
script (`admin@promo.test` / `Admin@12345`, or whatever you set in `.env`) at `/signin`.

### Useful seeded coupons

| Code | Type | Value | Min Order | Max Discount | Categories | Limits |
|---|---|---|---|---|---|---|
| `SAVE20` | % | 20% | ₹300 | ₹500 | All | 100 total / 1 per user |
| `TECH20` | % | 20% | ₹1,000 | ₹1,000 | Electronics only | 50 total / 1 per user |
| `FLAT100` | Flat | ₹100 | ₹1,000 | — | All | 100 total |
| `EXPIRED20` | % | 20% | — | ₹500 | All | already expired, for testing |

## 14. Testing

```bash
cd server
npm install
# create a second database for tests, then:
cp .env.test.example .env.test   # if you don't already have server/.env.test — see below
npm test
```

`server/.env.test` should point `DATABASE_URL` at a **separate** database (e.g. `promo_db_test`)
so tests never touch your seeded demo data:

```
DATABASE_URL="postgresql://promo:promo@localhost:5432/promo_db_test?schema=public"
JWT_SECRET="test-secret-key"
```

Apply migrations to it once: `DATABASE_URL=postgresql://promo:promo@localhost:5432/promo_db_test npx prisma migrate deploy`.

Test suites (53 tests total, all passing against a real PostgreSQL instance):

- `promotionEngine.test.js`, `pricingEngine.test.js` — pure unit tests, no DB: category
  eligibility, min-order-against-eligible-subtotal, percentage/flat/cap math, allocation sums,
  invariants.
- `auth.integration.test.js` — signup/login, password hashing, default `USER` role, role
  spoofing rejected, invalid credentials.
- `security.integration.test.js` — IDOR checks: cross-user cart/order access denied, `USER` vs
  `ADMIN` endpoint access.
- `cart.integration.test.js` — stock validation, category-restricted discount allocation,
  apply-doesn't-consume-usage, min-order shortfall payload, expired/paused rejection, coupon
  removal recalculation.
- `checkout.integration.test.js` — full success flow (order, redemption, stock decrement, cart
  clear), payment-failed preserves everything, duplicate-idempotency-key dedup, and the
  concurrency test described above.
- `admin.integration.test.js` — promotion validation, create → immediately usable by a customer,
  pause blocks application, dashboard reflects real counts.

## 15. What was intentionally left out

Per scope: no real payment gateway, no shipping/tax APIs, no BOGO/tiered/stacked promotions, no
customer segmentation, no complex analytics platform — see the build brief for the full list.

# Admin Panel Guide (`/admin`)

Log in with the store password. Sessions last 12 hours. Five wrong attempts
locks that IP for 15 minutes.

## Dashboard
Today's paid orders + revenue, parcels waiting to ship, low-stock warnings
(≤ 5 copies), recent orders. Click anything to jump in.

## Products
- **List:** every title with price, stock and a **Visible** switch — flip a
  book off to hide it from the store instantly (existing orders unaffected).
- **Edit / New product:**
  - *Title, category, series, grade label* — the series/grade chips shown on cards.
  - *Description* — the 3–5 lines on the product page.
  - *MRP / Selling price* — in rupees. MRP shows struck-through with "% off".
  - *Sale price + window* — optional; auto-starts/stops at the dates.
  - *Stock* — decremented when orders are placed, restored if payment fails.
  - *Weight* — used for courier pricing (books ≈ 300–500 g).
  - *Cover / gallery* — images auto-convert to fast WebP.
  - *Sample PDF* — the "Preview sample pages" button on the product page.
  - *Flags* — Visible / New Release (home-page rail) / Featured.
- **Bundles:** create with type **Bundle**, then add member books + quantities.
  The product page shows "Inside this kit" and "You save ₹X" automatically.
  Keep the bundle price below the member total, that's the whole point.

## Orders
Tabs: **Needs action** (default — paid/confirmed/packing), All, Awaiting
payment, Shipped, Delivered, Failed/cancelled.

Order page actions (buttons appear only when valid):
- **Start packing** — mark you're on it.
- **Ship via Shiprocket (auto AWB)** — books courier + pickup + emails
  tracking to the customer. Needs Shiprocket configured.
- **Ship order** (manual) — you type courier/AWB/tracking URL; same email.
- **Out for delivery / Mark delivered** — manual override; automatic anyway
  when Shiprocket tracking sync is on.
- **Cancel order** — restocks; auto-refunds captured Razorpay payments.
- **Mark paid (manual)** — for a bank-transfer/offline payment you verified.

The page shows the customer's phone/email, the full address (plus a map link
if they pinned their doorstep), items to pack, payment state and a timeline.

## Coupons
Code (letters/numbers), % or flat ₹ off, min order, optional max-discount cap,
usage limit, validity window, active toggle. Usage counts increment only on
*paid* orders.

## Festival sales
Name + banner text + % / flat off + date range + categories (none = whole
store). Goes live and dies on schedule automatically; the home page shows the
banner while live. One sale runs at a time (the newest wins).

## Services
Edit the four showcase cards (SL Radio, workshops, SJIS, LMS): banner image,
tagline, description, link, order, visibility.

## Settings
- **COD allowed up to** (default ₹1,500) — above this, online payment only.
- **Email OTP from** (₹5,000) — bulk orders verify by email code.
- **Contact-us from** (₹20,000) — checkout replaced by call/WhatsApp card.
- **Flat shipping fee / free-shipping threshold** (0 = no free shipping).
- **Origin pincode** — where parcels ship from (delivery estimates use it).
- **Notice bar** — a one-line banner across the whole store (holidays etc.).
- **Contact phone/email** shown to customers.

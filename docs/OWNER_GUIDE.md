# SLPL Store — Owner's Guide

*For Saaradaa Learknowations Pvt Ltd. Last updated: 14 Jul 2026.*

This is the master document. Read this first; the other docs go deeper:

| Doc | What it covers |
|---|---|
| **INTEGRATIONS.md** | Razorpay KYC, Shiprocket signup, Cloudflare subdomain, real email — the accounts **only you** can create |
| **ADMIN_GUIDE.md** | Using the admin panel day-to-day |
| **DEPLOYMENT.md** | How the server stack works, updating the site |
| **RUNBOOK.md** | Backups, logs, and what to do when something breaks |
| **MIGRATION_R640.md** | Moving everything to the new rack server (+ Kubernetes) |

---

## 1. What you have

A complete e-commerce store, self-hosted on your own server:

- **Storefront** — home page with hero, horizontally-scrollable *New Releases*,
  category pages (Pre-Primary → Senior Secondary, Novels & Poems), product
  pages with **sample-PDF preview**, class **bundles** at bundled prices,
  services showcase (SL Radio, workshops, SJIS, LMS), search, light theme with
  a dark-mode toggle, Amazon-style cart (top-right on desktop, bottom bar on
  mobile).
- **Checkout** — saved addresses with pincode autofill and a **map pin-drop**
  ("mark your doorstep"), Home/Office labels, delivery-date estimate per
  pincode, coupons, Razorpay (UPI/cards/netbanking) + **COD below ₹1,500**
  (email-OTP confirmed), email-OTP gate for orders ≥ ₹5,000, and a
  "contact us" flow for orders ≥ ₹20,000. All thresholds editable in admin.
- **Payment safety** — if a customer's internet dies mid-payment, webhooks +
  a background reconciler settle every order to *paid*, *failed* or
  *auto-refunded*. Money is never in limbo; both sides get emails.
- **Admin panel** at `/admin` — products (covers, sample PDFs, prices,
  descriptions, stock), bundles, coupons, scheduled **festival sales**,
  orders with one-click Shiprocket shipping, services editor, settings.
- **Emails** at every step: order placed/confirmed, shipped (with tracking
  link), out-for-delivery, delivered, cancellations/refunds, plus a copy of
  every new order to `saradapublications18@gmail.com`.
- **Nightly database backups** (7 daily + 4 weekly kept on the server).

## 2. Where it runs

- Server: your laptop server (`slplserver`), Docker Compose stack `oms-*`.
- Store: **http://100.109.145.97:4300** (Tailscale/LAN) until you attach the
  public subdomain (2-minute job — INTEGRATIONS.md §4).
- Admin: `http://100.109.145.97:4300/admin` — password is the one you chose
  (change it later via `deploy/.env` → `ADMIN_PASSWORD_HASH`, see RUNBOOK §6;
  it was shared in chat, so rotate it before real launch).
- Mail viewer (until real SMTP): `ssh -L 8026:127.0.0.1:8026 slplserver@100.109.145.97`
  then open http://localhost:8026 — every email the store "sent" is there.

## 3. Launch checklist (in order)

1. ☐ **Razorpay account + KYC** (INTEGRATIONS §1). Until then the store runs
   in *mock payment* mode: orders work, money doesn't move.
2. ☐ **Shiprocket account** (INTEGRATIONS §2). Until then use *manual
   shipping*: you enter courier + AWB and the customer still gets the
   tracking email.
3. ☐ **Real SMTP** (INTEGRATIONS §3) so customers actually receive emails.
4. ☐ In `/admin` → Products: set **real prices**, upload real covers and any
   missing sample PDFs, fix descriptions, set stock counts.
5. ☐ In `/admin` → Products (bundles): attach the real book list to each kit.
6. ☐ In `/admin` → Settings: confirm thresholds, origin pincode, contact info.
7. ☐ Place one **test order yourself** end-to-end (Razorpay test keys first!).
8. ☐ Remove `ALLOW_MOCK_PAYMENTS` from `deploy/.env`, restart (RUNBOOK §2).
9. ☐ **Point the subdomain** in Cloudflare (INTEGRATIONS §4). You're live.

## 4. Day-to-day: what happens when an order arrives

1. You get an email: *"New paid order SLPL-xxxx-xxxxx"*.
2. Open `/admin` → Orders (the *Needs action* tab is the default).
3. Click the order → **Start packing** → pack the books.
4. Click **Ship via Shiprocket (auto AWB)** — this books the courier, prints
   the AWB, schedules pickup from Nagole, and emails the customer their
   tracking link. (Or **Ship order** to enter a courier + AWB manually.)
5. Done. Tracking updates, *out-for-delivery* and *delivered* emails are
   automatic (worker syncs the courier every 3 hours; Shiprocket also SMSes
   the customer directly).

Refunds/cancellations: the order page has **Cancel order** (restocks and
auto-refunds captured payments through Razorpay).

## 5. Discounts

- **Coupons** (`/admin` → Coupons): code, % or flat ₹, min order, usage
  limits, validity window. Customers type it at checkout.
- **Festival sales** (`/admin` → Festival sales): pick dates + discount +
  categories; the home-page banner and product-page sale prices switch on
  and off **automatically** at those dates. Nothing to remember on the day.
- **Per-book sale price** (product edit page): optional sale price with its
  own window — the strike-through and "% off" badge appear automatically.

The customer always gets the *cheapest* applicable price.

## 6. Answers to the questions you asked

- **Courier tie-up:** you don't need to visit anyone. Shiprocket signup is
  online; BlueDart itself now has 10-minute online Digital Account Opening.
  We ship through Shiprocket, which includes BlueDart, Delhivery, DTDC + 15
  more, picks the best rate per parcel, and handles buyer SMS/WhatsApp.
  The courier "gets the customer's number" because our software sends
  name/phone/email with each shipment via their API — same as robu.in.
- **Interrupted payments:** Razorpay's webhook + our 10-minute reconciler
  guarantee the money is never lost — captured-but-late payments are
  auto-refunded with an apology email.
- **Why light theme:** shoppers trust product photos on white (Amazon,
  Flipkart), and covers render truer. A dark toggle is in the header for
  those who want it.

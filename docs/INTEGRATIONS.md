# Integrations - accounts only you can create

Each section ends with the exact lines to put in `deploy/.env` on the server,
followed by: `cd ~/oms/deploy && docker compose --env-file .env up -d` to apply.

---

## 1. Razorpay (payments)

**What it gives you:** UPI, cards, netbanking, wallets at ~2% fee, settled to
your bank in T+2 days. No setup fee.

### Steps
1. Go to https://razorpay.com → **Sign Up**. Use the company email.
2. Verify email/phone. You land in **Test Mode** - this already works with the
   store for testing (test keys, no KYC needed).
3. **Test keys first:** Dashboard → Settings → API Keys → *Generate Test Keys*.
   Put them in `.env` (below), remove `ALLOW_MOCK_PAYMENTS`, restart, and place
   a test order with card `4111 1111 1111 1111` (any CVV/future date).
4. **Activate live mode:** Dashboard → *Activate your account* → business KYC:
   - Company PAN, CIN (you're a Pvt Ltd), bank account + cancelled cheque,
     registered address proof, director KYC.
   - Business category: *Education* → *Books & publications*.
   - Website: your store URL (point the subdomain first, §4).
   - Approval typically takes 2-4 working days.
5. Once approved: Settings → API Keys → **Generate Live Keys** → replace in `.env`.
6. **Webhook (required):** Settings → Webhooks → *Add New Webhook*:
   - URL: `https://<your-subdomain>/api/webhooks/razorpay`
   - Secret: invent a long random string (this is `RAZORPAY_WEBHOOK_SECRET`)
   - Events: `payment.captured`, `payment.failed`, `order.paid`
7. Branding: Settings → Branding → upload the SL logo + navy `#1e2a5a`.

```ini
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=the-secret-you-typed-in-step-6
# ALLOW_MOCK_PAYMENTS=   ← DELETE this line entirely
```

---

## 2a. Self-shipment with DTDC (current mode)

The store is set up for self-shipment: you pack, a DTDC agent picks up, and
you enter the consignment number in **Admin → Shipments**. Nothing to sign up
for - this works today. Two optional add-ons make it richer:

### SMS updates (Brevo transactional SMS)

Customers already get emails and in-app notifications at every stage. To also
send SMS (order confirmed, shipped with tracking number, out for delivery,
delivered):

1. In your Brevo account (same one as email, section 3): **SMS** →
   activate transactional SMS. SMS credits are prepaid (about 20-25 paise per
   SMS in India).
2. **India DLT requirement:** to send SMS in India you must register the
   company and a sender ID (e.g. `SLPLST`) on a DLT portal (Jio/Airtel/Vodafone
   TrustBox etc.) and get the message templates approved. Brevo's help pages
   walk through it. Until that is done, keep SMS off.
3. Get an API key: **SMTP & API** → API Keys → generate.

```ini
BREVO_API_KEY=xkeysib-...
SMS_SENDER=SLPLST
```

Add to `deploy/.env` on the server and restart. No key = no SMS, everything
else works.

### Automatic DTDC tracking (trackcourier.io)

DTDC has no free public API, so by default you advance orders yourself in
Admin → Shipments (Out for delivery / Mark delivered). To have the worker do
it automatically every 3 hours:

1. https://api.trackcourier.io → sign up (free tier: 100 lookups/month,
   plenty at current volume).
2. Copy the API key from the dashboard.

```ini
TRACKCOURIER_API_KEY=...
```

With the key set, the worker polls DTDC via trackcourier.io for every
in-transit consignment, appends checkpoints to the customer's timeline, and
flips orders to Out for delivery / Delivered (with the usual emails and SMS)
without you touching anything.

---

## 2. Shiprocket (courier)

**What it gives you:** one account → BlueDart, Delhivery, DTDC, Xpressbees,
India Post + more. Pay-per-shipment from a wallet (~₹32-45 per 500 g), no
monthly commitment on the free plan. Automatic buyer SMS/WhatsApp tracking,
COD collection (remitted to your bank), pickup from your address.

### Steps
1. https://www.shiprocket.in → **Sign Up** (email + phone).
2. Complete KYC: GST/PAN, bank account (for COD remittance).
3. **Pickup address:** Settings → Pickup Addresses → *Add* → the Nagole
   address → name it exactly `Primary` (or set `SHIPROCKET_PICKUP_LOCATION`
   to whatever you name it).
4. Recharge the wallet (₹500 is enough to start).
5. **API user:** Settings → API → *Create API User* → any email that is NOT
   your login email (e.g. `api@theslpl.in`) + a password. These are the two
   values below - not your normal login!
6. After this, the admin panel's **"Ship via Shiprocket (auto AWB)"** button
   goes live, and pincode delivery estimates switch from the built-in zone
   table to live courier quotes automatically.

```ini
SHIPROCKET_EMAIL=api@theslpl.in
SHIPROCKET_PASSWORD=the-api-user-password
SHIPROCKET_PICKUP_LOCATION=Primary
```

**COD note:** COD money is collected by the courier → Shiprocket remits to
your bank on a D+7ish cycle. Enable *Early COD* later if cash flow needs it.

---

## 3. Real email (Brevo - free 300 emails/day)

Until this is done, emails only land in the private Mailpit viewer.

1. https://www.brevo.com → sign up free.
2. **Senders & Domains** → add domain `theslpl.in` → it shows 2-3 DNS records
   (DKIM/DMARC) → add them in **Cloudflare → theslpl.in → DNS** → verify.
3. **SMTP & API** → SMTP tab → note server/port/login → *Generate SMTP key*.

```ini
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=0
SMTP_USER=<the login shown>
SMTP_PASS=<the SMTP key>
SMTP_FROM="SLPL Store <store@theslpl.in>"
```

(Alternative: a Hostinger mailbox works too - host `smtp.hostinger.com`,
port 465, `SMTP_SECURE=1`, the mailbox address + password.)

---

## 4. Cloudflare subdomain (going public)

You already run everything through a Cloudflare tunnel, so this is one entry:

1. Cloudflare Zero Trust → **Networks → Tunnels** → your existing tunnel →
   **Public Hostname** → *Add a public hostname*.
2. Subdomain: e.g. `store` · Domain: `theslpl.in` · Path: empty.
3. Service: **HTTP** · URL: `localhost:4300`.
4. Save. Live in ~30 seconds at `https://store.theslpl.in`.

Then tell Razorpay (webhook URL, §1 step 6) and set the store URL in your
Razorpay/Shiprocket profiles.

---

## 5. Later / optional

- **SMS OTP instead of email OTP** (bulk orders/COD): MSG91 or Fast2SMS.
  Requires DLT registration (TRAI): register the Pvt Ltd on a DLT portal
  (e.g. Jio/Airtel DLT), get Entity ID, register sender ID (e.g. `SLPLST`)
  and message templates, then plug MSG91 keys in. Budget ~₹0.20/SMS.
  The OTP plumbing already exists - only the "send" transport changes.
- **GST invoices:** printed books are generally GST-exempt (nil rate); the
  order emails serve as receipts today. Confirm with your CA whether you
  need formal invoice PDFs; the data model already stores everything needed.
- **Google login**, **direct BlueDart contract** (once volumes justify a
  rate negotiation - the adapter seam is `src/lib/shipping/estimate-source.ts`).

---

## 6. Google Maps for the checkout map (optional)

The address pin works out of the box with OpenStreetMap. To switch to Google
Maps (better satellite/roads in India):

1. https://console.cloud.google.com → create project `slpl-store`.
2. APIs & Services → Library → enable **Maps JavaScript API** (the map) and
   **Geocoding API** (turns the pin into city/state/pincode).
3. APIs & Services → Credentials → *Create credentials* → **API key**.
4. Restrict the key: Application restrictions → Websites →
   `https://store.theslpl.in/*`; API restrictions → the two APIs above.
5. Billing must be enabled (card required). Google gives a recurring
   **$200/month free credit**; a store this size stays comfortably inside it.

```ini
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

Note: this is a build-time variable, so after adding it run a full rebuild:
`docker compose --env-file .env up -d --build oms-web`.

## 7. Login with Google (optional)

1. Same Google Cloud project → APIs & Services → **OAuth consent screen**:
   External, app name `SLPL Store`, your support email, add domain
   `theslpl.in`, publish the app.
2. Credentials → *Create credentials* → **OAuth client ID** → Web application:
   - Authorized JavaScript origins: `https://store.theslpl.in`
   - Authorized redirect URIs: `https://store.theslpl.in/api/auth/google/callback`
3. Copy the client ID + secret into `.env`:

```ini
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
APP_URL=https://store.theslpl.in
```

4. Rebuild (`docker compose --env-file .env up -d --build oms-web`). The
   "Continue with Google" button appears on the login and signup pages
   automatically. Google accounts are matched to existing customers by email.

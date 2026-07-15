# SLPL Store (OMS)

The official e-commerce store of **Saaradaa Learknowations Pvt Ltd**: school textbooks (Baby Steps, Little Leaps, Skill Builders), novels, poem books and complete class bundles, plus a showcase of SLPL services (SL Radio, English workshops, the SJIS journal and the SL LMS).

**Live:** https://store.theslpl.in

## Features

- Storefront with a rotating 3D product dome, scrollable New Releases, category pages, product pages with sample PDF preview, bundles and search
- Light theme by default with a dark mode toggle
- Amazon-style layout: brand top left, central search, deliver-to pincode chip, cart top right, category strip
- Accounts, saved addresses with pincode autofill and a map pin-drop for the exact doorstep
- Razorpay payments (UPI, cards, netbanking) with webhook plus reconciliation, so interrupted payments always settle to paid, failed or auto-refunded
- Cash on Delivery below a configurable limit, confirmed by email OTP
- Email OTP gate for bulk orders and a contact-us flow for institutional orders
- Delivery estimates per pincode (Shiprocket serviceability with a zone-table fallback)
- Admin panel: products (covers, sample PDFs, prices, stock), bundles, coupons, scheduled festival sales, order management with one-click Shiprocket shipping, settings and services editor
- Lifecycle emails: order confirmed, shipped with tracking link, out for delivery, delivered
- Nightly database backups with retention

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4 + shadcn/ui, PostgreSQL 16 + Prisma 7, Razorpay, Shiprocket, Docker Compose (Kubernetes manifests included for k3s).

## Repository layout

```
app/       Next.js application (src/app routes, src/lib engine, prisma schema and seed)
deploy/    docker-compose.yml, .env.example, deploy script, backup job, k8s manifests
docs/      owner guide, integrations, admin guide, deployment, runbook, migration guide
assets/    brand source assets
```

## Quick start (development)

```bash
cd app
cp ../deploy/.env.example .env   # fill in DATABASE_URL, SESSION_SECRET, etc.
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev                      # http://localhost:3000
npm run worker                   # background jobs (payments, tracking)
```

## Production

```bash
./deploy/deploy.sh          # sync to the server, build, migrate, restart
./deploy/deploy.sh --seed   # first deploy only
```

The stack publishes a single port (4300) behind a Cloudflare tunnel. See `docs/DEPLOYMENT.md` for architecture and `docs/RUNBOOK.md` for operations.

## Documentation

| Doc | Purpose |
|---|---|
| `docs/OWNER_GUIDE.md` | What exists, launch checklist, daily order flow |
| `docs/INTEGRATIONS.md` | Razorpay KYC, Shiprocket, Cloudflare, SMTP setup |
| `docs/ADMIN_GUIDE.md` | Admin panel manual |
| `docs/DEPLOYMENT.md` | Architecture, updating, local development |
| `docs/RUNBOOK.md` | Logs, backups, restore, troubleshooting |
| `docs/MIGRATION_R640.md` | Moving to new hardware, Compose or k3s |

## License

MIT (see LICENSE). Brand assets, book content and the SLPL name remain the property of Saaradaa Learknowations Pvt Ltd.

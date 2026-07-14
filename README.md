# SLPL Store (OMS)

E-commerce store for **Saaradaa Learknowations Pvt Ltd** — school textbooks
(Baby Steps · Little Leaps · Skill Builders), novels, poems and class bundles,
plus the services showcase (SL Radio, workshops, SJIS, LMS).

- **Stack:** Next.js 16 (App Router, TS) · Tailwind v4 + shadcn/ui · Postgres 16
  + Prisma 7 · Razorpay · Shiprocket · Docker Compose (k3s manifests included)
- **Runs at:** `http://100.109.145.97:4300` on `slplserver` (Cloudflare
  tunnel subdomain to be attached — see docs/INTEGRATIONS.md §4)
- **Admin:** `/admin`

## Documentation (start here → `docs/`)

| | |
|---|---|
| `docs/OWNER_GUIDE.md` | **Read first.** What exists, launch checklist, daily flow |
| `docs/INTEGRATIONS.md` | Razorpay KYC · Shiprocket · Cloudflare · SMTP — owner-action steps |
| `docs/ADMIN_GUIDE.md` | Admin panel manual |
| `docs/DEPLOYMENT.md` | Architecture, updating, local dev |
| `docs/RUNBOOK.md` | Logs, backups/restore, troubleshooting, secret rotation |
| `docs/MIGRATION_R640.md` | Move to the rack server (Compose or k3s) |

## Quick commands

```bash
./deploy/deploy.sh              # deploy latest code to the server
./deploy/deploy.sh --seed       # first deploy only (loads catalog)
cd app && npm run dev           # local dev (needs the SSH tunnel — DEPLOYMENT.md)
cd app && NODE_OPTIONS=--conditions=react-server npx tsx scripts/e2e-test.ts  # order-engine test
```

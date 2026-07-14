# Deployment

## Architecture

```
Cloudflare tunnel (existing)          laptop server (slplserver)
  <subdomain> ──► localhost:4300 ──►  oms-web      Next.js 16 (storefront + admin + API)
                                      oms-worker   cron: payment reconcile / stock expiry / tracking sync
                                      oms-db       Postgres 16 (internal network only)
                                      oms-migrate  one-shot prisma migrate on each deploy
                                      oms-mailpit  outgoing-mail viewer (127.0.0.1:8026)
                                      oms-backup   nightly pg_dump → volume (7 daily + 4 weekly)
volumes: oms-db (database) · oms-uploads (covers/PDFs) · oms-backups
```

- Only published port: **4300** (chosen from your free-port scan). Postgres is
  never exposed to the host.
- Prices are stored in **paise** everywhere.
- The stack is 12-factor: all secrets/config in `deploy/.env`; code is
  stateless; state lives in the three volumes. That's what makes the R640
  move trivial.

## Repo layout

```
OMS/
├─ app/          Next.js app (src/app = routes, src/lib = engine, prisma/ = schema+seed)
├─ deploy/       docker-compose.yml, .env.example, deploy.sh, backup/, k8s/
├─ docs/         this documentation
├─ assets/       brand source assets
└─ design-system/MASTER.md  (brand tokens the UI follows)
```

## Deploying an update

From this machine:

```bash
cd /mnt/Fire/E2E/OMS
./deploy/deploy.sh          # rsync → build on server → migrate → restart
```

First-ever deploy also needs `./deploy/deploy.sh --seed` (loads the catalog).

Manual (on the server):

```bash
cd ~/oms/deploy
docker compose --env-file .env up -d --build   # build + restart changed services
docker compose logs -f oms-web                 # watch logs
```

## Environment (`deploy/.env` on the server)

See `.env.example` — every key documented. Highlights:
- `DATABASE_URL`, `POSTGRES_*` — internal DB.
- `SESSION_SECRET` — 64 hex chars; rotating it logs everyone out.
- `ADMIN_PASSWORD_HASH` — bcrypt hash of the admin password.
- `RAZORPAY_*`, `SHIPROCKET_*`, `SMTP_*` — filled as you finish INTEGRATIONS.md.
- `ALLOW_MOCK_PAYMENTS=1` — demo-mode payments; **delete when Razorpay keys go in**.

## Local development (this machine)

```bash
# dev DB + mail live on the server, reached over an SSH tunnel:
ssh -f -N -L 15433:127.0.0.1:5433 -L 11025:127.0.0.1:1025 -L 18025:127.0.0.1:8025 slplserver@100.109.145.97
cd app && npm run dev        # http://localhost:3000, app/.env already points at the tunnel
npm run worker               # optional: background jobs
npx prisma studio            # browse the dev database
```

## Performance & scaling posture

Current traffic needs one instance of everything (the laptop idles at
load ≈ 0.2). When growth comes: Cloudflare already caches static assets at
the edge; `oms-web` is stateless so it scales horizontally (compose
`--scale`, or `replicas:` on k3s per `deploy/k8s/`); Postgres and uploads
are the stateful pieces and move with their volumes. The worker must always
be a single instance.

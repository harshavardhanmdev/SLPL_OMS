# Runbook - operations & troubleshooting

All commands run on the server (`ssh slplserver@100.109.145.97`), from
`~/oms/deploy` unless said otherwise.

## 1. Health & logs

```bash
docker ps --filter name=oms-             # everything Up? web should say (healthy)
curl -s localhost:4300/api/health        # {"ok":true}
docker compose logs -f oms-web           # web logs
docker compose logs -f oms-worker        # cron logs (reconciler/tracking)
docker compose logs --tail 50 oms-backup # last backup runs
```

## 2. Restart / apply .env changes

```bash
docker compose --env-file .env up -d            # recreates changed containers
docker compose restart oms-web oms-worker       # plain restart
```

## 3. Backups

- Automatic: nightly 02:15 into the `oms-backups` volume; 7 daily + 4 weekly kept.
- List: `docker run --rm -v oms-backups:/b alpine ls -lh /b`
- Manual now: `docker exec oms-backup sh -c 'pg_dump -Fc -f /backups/manual-$(date +%s).dump'`
- Copy off-server (do this monthly, e.g. into Nextcloud):
  `docker run --rm -v oms-backups:/b -v /home/slplserver/offsite:/o alpine cp -a /b /o`

### Restore drill (also = disaster recovery)
```bash
docker exec -it oms-db psql -U oms -c 'CREATE DATABASE oms_restore;'
docker run --rm --network deploy_default -v oms-backups:/b postgres:16-alpine \
  pg_restore -h oms-db -U oms -d oms_restore --clean --if-exists /b/<file>.dump
# verify, then either point DATABASE_URL at oms_restore or restore into oms the same way
```

## 4. Common situations

| Symptom | Likely cause → fix |
|---|---|
| Customer paid, order still "Awaiting payment" | Webhook missed. The worker reconciles within 10 min - check `oms-worker` logs. Manual: admin → order → *Mark paid (manual)* only after seeing the payment in the Razorpay dashboard. |
| Emails not arriving | Real SMTP not configured (check Mailpit viewer :8026) or Brevo creds wrong - `docker compose logs oms-web \| grep email`. Failures are also listed in DB table `EmailLog`. |
| "Ship via Shiprocket" errors | Wallet empty, pickup address name ≠ `SHIPROCKET_PICKUP_LOCATION`, or API-user creds wrong. The error text says which. Fall back to manual *Ship order* meanwhile. |
| Store slow / down | `docker ps` → is `oms-web` restarting? `docker compose logs oms-web`. Disk full? `df -h`. DB up? `/api/health`. |
| Stock looks wrong | Failed/expired orders restock automatically within 10 min (worker). Check the order's timeline for EXPIRED/FAILED events. |
| Forgot admin password | Set a new `ADMIN_PASSWORD_HASH` in `.env` (see §6) and `docker compose up -d oms-web`. |

## 5. Payment stuck-state map (how the engine settles)

- Browser died after paying → webhook flips to PAID (secs) or reconciler (≤10 min).
- Webhook + reconciliation both saw nothing in 30 min → order EXPIRED, stock restored.
- Payment captured *after* expiry → auto-refund + apology email.
- Double payment on one order → Razorpay Orders API binds attempts; extra captures auto-refund.

## 6. Rotating secrets

```bash
# new admin password hash:
docker run --rm node:22-alpine node -e "console.log(require('bcryptjs').hashSync(process.argv[1],11))" 'NewPassword' \
  2>/dev/null || docker exec oms-worker node -e "console.log(require('bcryptjs').hashSync(process.argv[1],11))" 'NewPassword'
# paste into deploy/.env → ADMIN_PASSWORD_HASH, then:
docker compose --env-file .env up -d oms-web
```
`SESSION_SECRET` rotation: same procedure (`openssl rand -hex 32`); all
customers get logged out (carts survive - they're in the DB/localStorage).

## 7. Dev leftovers on the server

`oms-dev-db` (port 5433) and `oms-dev-mailpit` (1025/8025) are the
*development* database/mail used while building from the workstation. Keep
them (they cost ~100 MB RAM) or remove with
`docker rm -f oms-dev-db oms-dev-mailpit` once development settles.

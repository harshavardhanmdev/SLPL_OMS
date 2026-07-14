# Moving to the Dell R640

The stack is deliberately portable: code (git) + `deploy/.env` + three Docker
volumes = the entire store. Two routes; both keep the same Cloudflare tunnel
pattern (install `cloudflared` on the R640 and move the tunnel, or run both
machines during cutover).

## Route A — Docker Compose on the R640 (recommended first step)

Downtime: ~5 minutes, done at night.

```bash
# 1. On the R640: install Docker
curl -fsSL https://get.docker.com | sh

# 2. Copy code + env from the laptop
rsync -az ~/oms/ r640:~/oms/            # includes deploy/.env — keep it 0600

# 3. On the laptop: stop writes, take a final backup, export volumes
cd ~/oms/deploy && docker compose stop oms-web oms-worker
docker exec oms-backup sh -c 'pg_dump -Fc -f /backups/migration.dump'
docker run --rm -v oms-uploads:/v -v $PWD:/out alpine tar czf /out/uploads.tgz -C /v .
docker run --rm -v oms-backups:/v -v $PWD:/out alpine cp /v/migration.dump /out/

# 4. Ship state to the R640
scp uploads.tgz migration.dump r640:~/oms/deploy/

# 5. On the R640: start DB, restore, load uploads, start everything
cd ~/oms/deploy
docker compose --env-file .env up -d oms-db
docker run --rm --network deploy_default -v $PWD:/in postgres:16-alpine \
  sh -c 'pg_restore -h oms-db -U oms -d oms --clean --if-exists /in/migration.dump'
docker run --rm -v oms-uploads:/v -v $PWD:/in alpine tar xzf /in/uploads.tgz -C /v
docker compose --env-file .env up -d --build

# 6. Point the Cloudflare tunnel route at the R640's localhost:4300
#    (or install cloudflared on the R640 and move the tunnel there)
```

Verify: `curl localhost:4300/api/health`, log into `/admin`, check an order page.

## Route B — k3s (Kubernetes) on the R640

Once Route A runs happily, or directly if you prefer:

1. `curl -sfL https://get.k3s.io | sh -` (single-node k3s, ~1 GB overhead).
2. Build images on the R640: `docker build -t oms-web:latest --target runner app/`
   and `-t oms-worker:latest --target builder`, then
   `docker save oms-web oms-worker | sudo k3s ctr images import -`.
3. Follow `deploy/k8s/README.md` (namespace → secret from your `.env` →
   postgres → web → worker).
4. Restore the DB dump into the postgres pod the same way as Route A step 5.
5. Traffic: run cloudflared as a Deployment in-cluster pointing at
   `http://oms-web.oms.svc` — or keep it simple with a hostPort.

Why k3s only on the R640: the laptop already runs ~16 compose containers and
swap is full; k8s adds overhead with zero benefit at this scale. On the R640
you get the room to learn it properly, plus `replicas: 2` web scaling when
traffic ever demands it.

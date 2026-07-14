# Kubernetes (k3s) manifests — for the Dell R640

These mirror the Docker Compose stack 1:1. Use them **after** the R640 arrives
(see `docs/MIGRATION_R640.md`). On the current laptop, stay on Compose.

## Order of operations

```bash
# on the R640, once k3s is installed (curl -sfL https://get.k3s.io | sh -)
kubectl apply -f namespace.yaml
# create the real secret (never commit it):
kubectl -n oms create secret generic oms-env --from-env-file=../.env
kubectl apply -f postgres.yaml
kubectl apply -f web.yaml
kubectl apply -f worker.yaml
kubectl apply -f ingress.yaml   # k3s ships Traefik; route via cloudflared instead if preferred
```

Build/push the image first (any registry, or `docker save | k3s ctr images import`):

```bash
docker build -t oms-web:latest --target runner ../app
docker build -t oms-worker:latest --target builder ../app
```

Notes
- `postgres.yaml` uses a `local-path` PVC (k3s default StorageClass).
- Uploads use a PVC mounted at `/app/uploads` on the web pod.
- Scale the web Deployment (`replicas: 2+`) freely — the app is stateless;
  note the in-memory rate limiter becomes per-pod (fine behind Cloudflare).
- The worker must stay at `replicas: 1` (cron jobs must not double-fire).

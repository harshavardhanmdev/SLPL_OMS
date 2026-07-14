#!/usr/bin/env bash
# Deploy the SLPL Store to the server.
#   ./deploy/deploy.sh            → rsync + build + up
#   ./deploy/deploy.sh --seed     → additionally run the catalog seed once
set -euo pipefail

SERVER="${OMS_SERVER:-slplserver@100.109.145.97}"
REMOTE_DIR="~/oms"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "── Syncing code to $SERVER:$REMOTE_DIR (tar over ssh — server has no rsync)"
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
tar -C "$ROOT" -czf - \
  --exclude='app/node_modules' --exclude='app/.next' --exclude='.git' \
  --exclude='app/.env' --exclude='app/uploads' \
  app deploy docs | ssh "$SERVER" "cd $REMOTE_DIR && tar xzf -"

echo "── Checking deploy/.env on the server"
if ! ssh "$SERVER" "test -f $REMOTE_DIR/deploy/.env"; then
  echo "!! $REMOTE_DIR/deploy/.env missing on the server."
  echo "   Copy deploy/.env.example there, fill it in, then re-run."
  exit 1
fi

echo "── Building & starting containers (first build takes a few minutes)"
ssh "$SERVER" "cd $REMOTE_DIR/deploy && docker compose --env-file .env up -d --build"

if [[ "${1:-}" == "--seed" ]]; then
  echo "── Seeding catalog"
  ssh "$SERVER" "cd $REMOTE_DIR/deploy && docker compose --env-file .env run --rm oms-migrate npx prisma db seed"
fi

echo "── Status"
ssh "$SERVER" "docker ps --filter name=oms- --format '{{.Names}}\t{{.Status}}'"
echo
echo "Store:   http://100.109.145.97:4300  (LAN/Tailscale)"
echo "Next:    add Cloudflare tunnel route <subdomain> → http://localhost:4300"

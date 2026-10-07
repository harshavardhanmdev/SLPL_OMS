#!/bin/sh
# Puts the training demo back to clean made-up data: the tutorial schools,
# staff and bills from the template database oms_tutorial_demo on the dev
# server, the live price list (rates only, no people), every login on the demo
# password, and the demo owner login. Whatever was done in the demo is wiped.
# Run on the server from ~/oms/deploy/demo.
#
# demo/.env (server only, never committed) holds:
#   DEMO_DB_PASSWORD=...         DEMO_SESSION_SECRET=...
#   DEMO_ADMIN_EMAIL=...         DEMO_HASH='bcrypt hash of the demo password'
set -eu
cd "$(dirname "$0")"
. ./.env

docker compose up -d demo-db demo-mail
# The health check, not pg_isready: a new database restarts once while it sets itself up
until [ "$(docker inspect -f '{{.State.Health.Status}}' oms-demo-db)" = healthy ]; do sleep 2; done

echo "== training data"
docker exec oms-demo-db psql -q -U oms -d postgres -c "DROP DATABASE IF EXISTS oms WITH (FORCE)" -c "CREATE DATABASE oms"
docker exec oms-dev-db sh -c 'pg_dump -U "$POSTGRES_USER" -d oms_tutorial_demo -Fc' |
  docker exec -i oms-demo-db pg_restore --no-owner -U oms -d oms

echo "== live price list"
docker exec oms-demo-db psql -q -U oms -d oms -c 'DELETE FROM "PriceListItem"'
docker exec oms-db pg_dump -U oms -d oms --data-only --table='"PriceListItem"' |
  docker exec -i oms-demo-db psql -q -U oms -d oms

echo "== logins"
docker exec -i oms-demo-db psql -q -U oms -d oms -v email="$DEMO_ADMIN_EMAIL" -v hash="$DEMO_HASH" <<'SQL'
UPDATE "AdminUser" SET "passwordHash" = :'hash', "mustChangePassword" = false;
INSERT INTO "AdminUser" ("id", "email", "name", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
VALUES ('demo-owner', :'email', 'Demo Admin', :'hash', 'OWNER', true, NOW(), NOW())
ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "role" = 'OWNER', "isActive" = true;
SQL

docker compose up -d --force-recreate demo-migrate demo-web
echo "== demo ready on port 4310"

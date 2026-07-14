#!/bin/sh
# Nightly compressed pg_dump at 02:15 IST with retention:
#   keep 7 daily dumps + 4 Sunday (weekly) dumps.
# Restore: pg_restore -h oms-db -U $PGUSER -d $PGDATABASE --clean /backups/<file>
set -eu

echo "[backup] service started; dumping daily at 02:15"

while true; do
  now=$(date +%H%M)
  if [ "$now" = "0215" ]; then
    stamp=$(date +%Y%m%d)
    day=$(date +%u) # 7 = Sunday
    file="/backups/oms-${stamp}.dump"
    if pg_dump -Fc -f "$file" 2>/tmp/err; then
      echo "[backup] wrote $file ($(du -h "$file" | cut -f1))"
      if [ "$day" = "7" ]; then
        cp "$file" "/backups/weekly-oms-${stamp}.dump"
      fi
      # Retention
      ls -1t /backups/oms-*.dump 2>/dev/null | tail -n +8 | xargs -r rm -f
      ls -1t /backups/weekly-oms-*.dump 2>/dev/null | tail -n +5 | xargs -r rm -f
    else
      echo "[backup] FAILED: $(cat /tmp/err)"
    fi
    sleep 70
  fi
  sleep 30
done

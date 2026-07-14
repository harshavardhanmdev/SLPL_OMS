#!/usr/bin/env bash
# Local preflight before deploying: build must pass.
set -euo pipefail
cd "$(dirname "$0")/../app"
npm run build
echo "PREFLIGHT-OK"

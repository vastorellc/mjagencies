#!/usr/bin/env bash
# dev-pm2-smoke.sh — Wave-0 helper for REQ-007: verifies 12 PgBouncer PM2 processes are online
#
# Requires:
#   - PM2 installed globally: npm install -g pm2@5
#   - jq available: brew install jq (macOS) or apt install jq (Linux)
#   - Postgres running: docker compose --profile dev up -d
#   - PgBouncer configs generated: bash scripts/gen-pgbouncer-config.sh
#   - ECOMMERCE_DB_PASSWORD env var set (for PgBouncer connectivity test)
#
# Usage:
#   pm2 start ecosystem.config.cjs
#   bash scripts/dev-pm2-smoke.sh
#
# Note on instance count (from PLAN 01-02 §Task 2.2 line ~416):
#   M001 ships 12 active PgBouncers (one per agency).
#   The 13th port slot (6444) is reserved for the M002 platform-shared admin connection.
#   The count assertion below checks for exactly 12.
#
# Used by Plan 01-05 CI job: dev-pm2-smoke

set -euo pipefail

EXPECTED_COUNT=12

echo "[dev-pm2-smoke] Checking PM2 PgBouncer instances..."

# Count PgBouncer PM2 processes
count=$(pm2 jlist | jq '[.[] | select(.name | startswith("pgbouncer-"))] | length')

if [ "$count" -ne "$EXPECTED_COUNT" ]; then
  echo "[dev-pm2-smoke] ERROR: Expected $EXPECTED_COUNT PgBouncer instances; got $count"
  echo ""
  echo "[dev-pm2-smoke] Current PM2 process list (name + status):"
  pm2 jlist | jq -r '.[] | "\(.name): \(.pm2_env.status)"'
  echo ""
  echo "[dev-pm2-smoke] Hint: run 'pm2 start ecosystem.config.cjs' to start all PgBouncers."
  exit 1
fi

echo "[dev-pm2-smoke] Found $count PgBouncer instances."

# Verify all PgBouncer instances have status=online
errored=$(pm2 jlist | jq '[.[] | select(.name | startswith("pgbouncer-")) | select(.pm2_env.status != "online")] | length')
if [ "$errored" -gt 0 ]; then
  echo "[dev-pm2-smoke] ERROR: Some PgBouncer instances are not online:"
  pm2 jlist | jq -r '.[] | select(.name | startswith("pgbouncer-")) | "\(.name): \(.pm2_env.status)"'
  exit 1
fi

echo "[dev-pm2-smoke] All $count PgBouncer instances are online."

# Quick connectivity sanity check through ecommerce PgBouncer (port 6433)
# Tests that PgBouncer is actually accepting connections (not just that PM2 started the process).
if [ -z "${ECOMMERCE_DB_PASSWORD:-}" ]; then
  echo "[dev-pm2-smoke] WARNING: ECOMMERCE_DB_PASSWORD not set — skipping PgBouncer connectivity test."
  echo "[dev-pm2-smoke] Set this var to enable the end-to-end connectivity assertion."
else
  echo "[dev-pm2-smoke] Testing PgBouncer connectivity: ecommerce_db via port 6433..."
  PGPASSWORD="$ECOMMERCE_DB_PASSWORD" psql \
    -h 127.0.0.1 \
    -p 6433 \
    -U ecommerce_user \
    -d ecommerce_db \
    -c 'SELECT 1' \
    >/dev/null 2>&1 && \
    echo "[dev-pm2-smoke] PgBouncer connectivity: OK (SELECT 1 via ecommerce port 6433 succeeded)." || \
    { echo "[dev-pm2-smoke] ERROR: Could not connect to ecommerce_db via PgBouncer port 6433."; \
      echo "[dev-pm2-smoke] Ensure Postgres is running (docker compose up -d) and userlist.ecommerce.txt has the correct SCRAM hash."; \
      exit 1; }
fi

echo ""
echo "[dev-pm2-smoke] PgBouncer dev smoke: OK"

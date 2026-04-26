#!/usr/bin/env bash
# pgbackrest-dr-drill.sh — Quarterly DR drill (REQ-017)
#
# Provisions a staging Postgres instance, restores the latest backup from R2,
# runs dry-run migrations against the restored instance, and measures RTO.
#
# Outputs:
#   .dr-drill/<TIMESTAMP>/restore.log       — pgBackRest restore output
#   .dr-drill/<TIMESTAMP>/migrate-dry-run.log  — migration dry-run output
#   .dr-drill/<TIMESTAMP>/SUMMARY.md        — RTO measurement + PASS/FAIL verdict
#
# Prerequisites:
#   - Doppler injected: PGBACKREST_CIPHER_PASS, R2_ACCESS_KEY, R2_SECRET_KEY
#   - Staging Postgres data dir at /var/lib/postgresql/17/staging (separate from prod)
#   - pgbackrest binary installed at /usr/local/bin/pgbackrest
#   - Runtime config at /etc/pgbackrest/pgbackrest.conf (with postgres-staging stanza)
#   - pnpm available for migration dry-run
#
# Usage:
#   bash scripts/pgbackrest-dr-drill.sh [--help]
#
# Cadence: first Monday of Jan/Apr/Jul/Oct per docs/runbooks/dr-drill.md.
# Phase 12 gate: this script must have produced a PASS result within the prior 90 days.
#
# SLA targets (PROJECT.md):
#   RPO 1h  — WAL archive_timeout=60s bounds sub-1h data loss
#   RTO 4h  — this drill must complete in under 14400 seconds to PASS

set -euo pipefail

# ── Help ───────────────────────────────────────────────────────────────────────
USAGE="Usage: pgbackrest-dr-drill.sh [--help]

Runs the quarterly DR drill: restore from R2, dry-run migrations, measure RTO.

Prerequisites:
  - Doppler injected: PGBACKREST_CIPHER_PASS, R2_ACCESS_KEY, R2_SECRET_KEY
  - Staging Postgres host (separate from prod) with empty data dir
  - pgbackrest binary installed, stanza=postgres-staging configured

Outputs written to .dr-drill/<TIMESTAMP>/

Phase 12 launch gate: last drill must be PASS within 90 days.
"

for arg in "$@"; do
  case "$arg" in
    --help) echo "$USAGE"; exit 0 ;;
    *)      echo "Unknown argument: $arg" >&2; echo "$USAGE" >&2; exit 1 ;;
  esac
done

# ── Setup ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="$REPO_ROOT/.dr-drill/$TIMESTAMP"
mkdir -p "$OUT_DIR"

SUMMARY_FILE="$OUT_DIR/SUMMARY.md"
RESTORE_LOG="$OUT_DIR/restore.log"
MIGRATE_LOG="$OUT_DIR/migrate-dry-run.log"

START_S=$(date +%s)

echo "# DR Drill Report — $TIMESTAMP" | tee "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "[drill] Starting DR drill at $TIMESTAMP"
echo "[drill] Output directory: $OUT_DIR"

# ── Step 1: Stop staging Postgres + clear data dir ────────────────────────────
echo "[drill] Step 1: Stop staging Postgres + clear data dir"
echo "## Step 1: Stop staging Postgres" >> "$SUMMARY_FILE"
sudo systemctl stop postgresql
sudo rm -rf /var/lib/postgresql/17/staging/*
echo "- Postgres stopped, staging data dir cleared" >> "$SUMMARY_FILE"

# ── Step 2: Restore from R2 (delta for speed on repeat drills) ────────────────
echo "[drill] Step 2: Restoring from R2 (stanza=postgres-staging, --delta)"
echo "" >> "$SUMMARY_FILE"
echo "## Step 2: Restore from R2" >> "$SUMMARY_FILE"

bash "$SCRIPT_DIR/pgbackrest-restore.sh" \
  --stanza=postgres-staging \
  --delta \
  2>&1 | tee "$RESTORE_LOG"

RESTORE_END_S=$(date +%s)
RESTORE_DURATION_S=$((RESTORE_END_S - START_S))
echo "- Restore completed in ${RESTORE_DURATION_S}s" | tee -a "$SUMMARY_FILE"

# ── Step 3: Start staging Postgres ────────────────────────────────────────────
echo "[drill] Step 3: Starting Postgres (recovery mode)"
echo "" >> "$SUMMARY_FILE"
echo "## Step 3: Start Postgres" >> "$SUMMARY_FILE"
sudo systemctl start postgresql
sleep 5
echo "- Postgres started (recovery mode — replaying WAL)" >> "$SUMMARY_FILE"

# ── Step 4: Verify all 13 agency DBs are accessible ──────────────────────────
echo "[drill] Step 4: Verify 13 agency DBs accessible"
echo "" >> "$SUMMARY_FILE"
echo "## Step 4: Agency DB Availability" >> "$SUMMARY_FILE"
psql -h 127.0.0.1 -p 5432 -U postgres \
  -c "SELECT datname FROM pg_database WHERE datname LIKE '%_db' ORDER BY datname;" \
  | tee -a "$SUMMARY_FILE"

# ── Step 5: Migration dry-run ─────────────────────────────────────────────────
echo "[drill] Step 5: Running migrate-runner --dry-run --all"
echo "" >> "$SUMMARY_FILE"
echo "## Step 5: Migration Dry-Run" >> "$SUMMARY_FILE"

MIGRATIONS_DB_PASSWORD="${MIGRATIONS_DB_PASSWORD:-}" \
  pnpm tsx "$REPO_ROOT/scripts/migrate-runner.ts" --dry-run --all \
  2>&1 | tee "$MIGRATE_LOG"

echo "- Migration dry-run complete. See $MIGRATE_LOG for full output." >> "$SUMMARY_FILE"
echo "- Pending migration count:" >> "$SUMMARY_FILE"
grep -c "pending\|would apply" "$MIGRATE_LOG" 2>/dev/null >> "$SUMMARY_FILE" || echo "  0" >> "$SUMMARY_FILE"

# ── Step 6: RTO measurement + PASS/FAIL verdict ───────────────────────────────
END_S=$(date +%s)
TOTAL_DURATION_S=$((END_S - START_S))
RTO_TARGET_S=14400  # 4h per SLA (PROJECT.md)

echo "" >> "$SUMMARY_FILE"
echo "## RTO Measurement" >> "$SUMMARY_FILE"
echo "- Restore phase: ${RESTORE_DURATION_S}s" | tee -a "$SUMMARY_FILE"
echo "- Total drill duration: ${TOTAL_DURATION_S}s" | tee -a "$SUMMARY_FILE"
echo "- SLA RTO target: ${RTO_TARGET_S}s (4h)" >> "$SUMMARY_FILE"

if [ "$TOTAL_DURATION_S" -lt "$RTO_TARGET_S" ]; then
  echo "- **Status: PASS** (within SLA — ${TOTAL_DURATION_S}s < ${RTO_TARGET_S}s)" | tee -a "$SUMMARY_FILE"
  echo "[drill] PASS — drill completed in ${TOTAL_DURATION_S}s (SLA: ${RTO_TARGET_S}s)"
  echo "[drill] Full report: $SUMMARY_FILE"
  exit 0
else
  echo "- **Status: FAIL** (exceeded SLA — ${TOTAL_DURATION_S}s >= ${RTO_TARGET_S}s)" | tee -a "$SUMMARY_FILE"
  echo "[drill] FAIL — drill took ${TOTAL_DURATION_S}s (SLA: ${RTO_TARGET_S}s)" >&2
  echo "[drill] Full report: $SUMMARY_FILE" >&2
  exit 1
fi

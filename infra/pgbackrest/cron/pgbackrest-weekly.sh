#!/usr/bin/env bash
# pgbackrest-weekly.sh — Weekly differential backup (03:00 UTC, Sunday)
# Invoked by crontab entry in infra/pgbackrest/cron/crontab.
# Output piped to logger so entries appear in syslog and Loki (via Plan 01-04 promtail).
#
# On failure, cron sends stdout/stderr to the system mail for postgres user.
# Independently, pgBackRest writes structured logs to /var/log/pgbackrest/.
#
# Retention: 12 weekly differentials (repo1-retention-diff=12, ~90 days).
set -euo pipefail
/usr/local/bin/pgbackrest \
  --stanza=postgres-main \
  --config=/etc/pgbackrest/pgbackrest.conf \
  --type=diff \
  backup 2>&1 | logger -t pgbackrest-weekly

#!/usr/bin/env bash
# pgbackrest-daily.sh — Daily incremental backup (02:00 UTC)
# Invoked by crontab entry in infra/pgbackrest/cron/crontab.
# Output piped to logger so entries appear in syslog and Loki (via Plan 01-04 promtail).
#
# On failure, cron sends stdout/stderr to the system mail for postgres user.
# Independently, pgBackRest writes structured logs to /var/log/pgbackrest/.
#
# Retention: 30 days of daily incrementals (repo1-retention-diff ladder).
set -euo pipefail
/usr/local/bin/pgbackrest \
  --stanza=postgres-main \
  --config=/etc/pgbackrest/pgbackrest.conf \
  --type=incr \
  backup 2>&1 | logger -t pgbackrest-daily

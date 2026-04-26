#!/usr/bin/env bash
# pgbackrest-monthly.sh — Monthly full backup (04:00 UTC, 1st of month)
# Invoked by crontab entry in infra/pgbackrest/cron/crontab.
# Output piped to logger so entries appear in syslog and Loki (via Plan 01-04 promtail).
#
# On failure, cron sends stdout/stderr to the system mail for postgres user.
# Independently, pgBackRest writes structured logs to /var/log/pgbackrest/.
#
# Retention: 84 monthly fulls (7 years) to align with REQ-018 vault retention.
# Full backups are larger — scheduled at 04:00 UTC (lowest traffic hour) per T-02-014.
set -euo pipefail
/usr/local/bin/pgbackrest \
  --stanza=postgres-main \
  --config=/etc/pgbackrest/pgbackrest.conf \
  --type=full \
  backup 2>&1 | logger -t pgbackrest-monthly

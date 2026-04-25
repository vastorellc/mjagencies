RUNBOOKS - MJAgency

These 13 runbooks are written in full during M012 (Launch + QA milestone).
Each is a separate file in this directory.

Files to be created in M012:
  deployment.md          - Canary deploy procedure (5% -> health check -> 100%)
  rollback.md            - Emergency rollback steps
  db-migration.md        - Schema migration procedure (dry-run + canary + rollback)
  new-agency.md          - Adding a 13th+ agency property
  subdomain-rename.md    - Agency identity change + 301 migration + Cal.com redirect
  incident-response.md   - Uptime < 99.9% triage procedure
  data-breach.md         - Security incident response (P0/P1/P2 levels)
  backup-restore.md      - Disaster recovery procedure (RPO 1h, RTO 4h)
  permission-expiry.md   - Asset permission expiry handling
  sla-breach.md          - 4h lead response SLA breach handling
  stripe-webhook.md      - Stripe payment reconciliation
  email-deliverability.md - Blacklist + bounce recovery
  emergency-access.md    - Owner locked out recovery procedure

See specs/milestone-M012.txt SLICE 5 for full runbook content requirements.

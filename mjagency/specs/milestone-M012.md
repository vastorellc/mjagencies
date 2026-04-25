MILESTONE M012 - LAUNCH + QA + SEEDS + RUNBOOKS + SLA
Branch: milestone/M012-launch-qa-seeds
Model: claude-sonnet-4-6
Depends on: M011 complete (all milestones done)
Read: ALL specs files (full QA pass against everything locked)

GOAL: Full QA matrix passes all 12 agencies. All content seeded.
      Canary deploy works. All 13 runbooks written. Brand Setup Wizard ready.
      gsd headless CI gate exits 0.

SLICES:

SLICE 1: Complete Content Seed (all 12 agencies)
  Task 1.1: Run full seed for all 12 agencies (see scripts/seed-plan.md)
    - Execute in sequence: main, ecommerce, growth, webdev, ai, branding,
      strategy, finance, engineering, product, video, graphic
    - Per agency: schema + CRM + booking + tools + content + media
    - Verify each agency passes content validators after seed
    - Log: agencies seeded, content items created, any failures
    - Retry failed items (max 3 attempts per item)
  Task 1.2: Content validator report
    - Word count: all P0 pages above floor
    - Alt text: 100% coverage
    - Citations: all stats sourced
    - Schema: all pages have correct schema
    - No placeholder text anywhere
    - All tool pages: benchmark data loaded + accessible

SLICE 2: Full QA Matrix
  Task 2.1: Multi-tenant isolation test
    - Attempt cross-agency data access via forged JWT (must fail)
    - Attempt cross-agency API call with modified agency_id (must fail)
    - RLS isolation test: raw query without agency_id returns no rows
  Task 2.2: Auth + Security tests
    - JWT refresh token replay: family revocation fires (test)
    - Server action without auth: returns Unauthorized (test)
    - Webhook without signature: returns 200 but not processed (test)
    - OWASP ZAP scan passes (from M011)
    - CSP nonce present on all pages
    - No jsonwebtoken in codebase (grep)
    - Payload version exactly 3.82.1 (automated check)
    - Next.js version >= 15.2.3 (automated check)
  Task 2.3: Content + Media tests
    - All P0 pages: word count above floor (12 agencies x all pages)
    - All image slots filled: no missing images
    - All real-only slots: real photos (no AI/stock humans)
    - All alt text: present, meaningful, >10 chars
    - No placeholder text in any page (grep scan)
  Task 2.4: Performance tests (Lighthouse CI)
    - All P0 pages: LCP <2.5s (warn at 1.8s)
    - All P0 pages: CLS = 0
    - All P0 pages: INP <200ms
    - Fail CI if any page misses budget
  Task 2.5: Accessibility tests
    - axe-core: zero critical violations (all P0 pages, all 12 agencies)
    - Keyboard navigation: Playwright test for all P0 pages
    - Focus ring: visible on all interactive elements (automated check)
  Task 2.6: E2E critical paths (Playwright)
    - Form submit -> contact created in CRM
    - Tool complete -> PDF emailed -> CRM contact created
    - Booking made -> CRM activity logged
    - Proposal sign -> CRM Won -> deposit invoice sent
    - Invoice paid -> Stripe webhook -> CRM updated
  Task 2.7: Cross-browser tests
    - Chrome, Safari, Firefox, Edge (desktop)
    - iOS Safari, Android Chrome (mobile, via BrowserStack or similar)

SLICE 3: Canary Deploy Pipeline
  Task 3.1: Canary deploy automation
    - deploy.sh script (or GitHub Action)
    - Step 1: deploy to 5% of traffic
    - Step 2: monitor 10 minutes (error rate, LCP, INP, CLS)
    - Step 3: if all green -> promote to 100%
    - Step 3 alt: if regression detected -> rollback within 60s
    - Cache purge: only on promote (not on canary)
    - Per-agency canary: --agency=finance tests one property first
  Task 3.2: Auto-rollback
    - Monitor: error rate spike >1% or LCP regression >15%
    - Auto-rollback: reverts to previous PM2 process
    - Alert: Slack message with rollback reason

SLICE 4: Pre-launch CI Gate
  Task 4.1: validate.sh script completion
    - All checks in scripts/validate.sh passing
    - Add new checks from QA matrix
    - gsd headless compatible exit codes (0/1/2)
  Task 4.2: Full gate run
    - Run: gsd headless --timeout 3600000 next
    - Verify exit 0
    - Any exit 1 or 2: fix and re-run

SLICE 5: Runbooks (13 total)
  Write all runbooks to /docs/runbooks/:
  Task 5.1: deployment.md      - Canary deploy procedure
  Task 5.2: rollback.md        - Emergency rollback steps
  Task 5.3: db-migration.md    - Schema migration procedure
  Task 5.4: new-agency.md      - Adding a 13th+ property
  Task 5.5: subdomain-rename.md - Agency identity change + 301 migration
  Task 5.6: incident-response.md - Uptime < 99.9% triage procedure
  Task 5.7: data-breach.md     - Security incident response
  Task 5.8: backup-restore.md  - Disaster recovery procedure
  Task 5.9: permission-expiry.md - Asset permission expiry handling
  Task 5.10: sla-breach.md     - 4h lead response SLA breach handling
  Task 5.11: stripe-webhook.md - Stripe payment reconciliation
  Task 5.12: email-deliverability.md - Blacklist + bounce recovery
  Task 5.13: emergency-access.md - Owner locked out recovery

SLICE 6: Brand Setup Wizard + Handoff Docs
  Task 6.1: Brand Setup Wizard UI
    - /admin/setup wizard (6-step, progress bar)
    - Step 1: Logo upload (primary + symbol required)
    - Step 2: Brand color (with ΔE check vs pre-seeded imagery)
    - Step 3: Brand identity (name, tagline, mission, tone)
    - Step 4: API keys (Stripe, Cal.com, email, Twilio)
    - Step 5: Domain setup (DNS instructions for subdomain pointing)
    - Step 6: Email warm-up status panel
        - Shows warm-up progress (days 1-35 timeline)
        - DKIM/SPF/DMARC verification status
        - Sequences locked in DRAFT until warm-up day 35 complete
        - Reminder emails: day 3 + day 7 post-wizard if not complete
        - "Activate Sequences" CTA appears on day 35 (owner clicks manually)
        - Owner cannot accidentally activate sequences early
    - Completion: shows "Your site is ready" with preview link
    - NOTE: Wizard does NOT complete warm-up — it initiates it.
      Sequences remain DRAFT for 35 days regardless of wizard completion.
  Task 6.2: Handoff documentation
    - /docs/brand-wizard.md: step-by-step owner guide
    - /docs/sla.md: SLA commitments document
    - /docs/architecture.md: technical overview for reference
    - /docs/post-launch-checklist.md: 14-day monitoring checklist
    - /docs/email-warmup.md: warm-up guide (what it is, why 35 days,
      what to expect, how to activate sequences when complete)

SLICE 7: 14-day Post-Launch Monitoring
  Task 7.1: Monitoring setup
    - All uptime alerts active
    - RUM dashboards populated
    - Error tracking live
    - Backup running + verified
  Task 7.2: Day 1 verification
    - All 12 agencies live (check subdomain routing)
    - GA4 events flowing
    - First form submit received (test)
    - Cal.com booking works
  Task 7.3: Day 7 check
    - CrUX data requested from Google
    - Email deliverability report
    - Content coverage audit run
    - Any blocking issues resolved

SUCCESS CRITERIA (all must pass before handoff):
  gsd headless exits 0 (pre-launch gate passes)
  All 12 agencies: P0 pages exist with real content
  All 12 agencies: content validators 100% green
  All 12 agencies: CRM pre-seeded and functional
  All 12 agencies: tools working with real benchmarks
  Canary deploy executes and promotes successfully
  Auto-rollback tested (intentional error triggers rollback)
  All 13 runbooks written and in /docs/runbooks/
  Brand Setup Wizard: completes in <30 minutes (timed test)
  OWASP ZAP: zero high-severity
  Playwright e2e: all critical paths pass
  Lighthouse CI: all budgets met on all P0 pages
  Cross-tenant isolation: verified
  JWT security: replay attack handled correctly
  No placeholder text: grep scan returns zero
  Payload version: exactly 3.82.1
  Next.js version: >= 15.2.3

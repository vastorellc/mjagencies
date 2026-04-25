MILESTONE M009 - CRM + FORMS + BOOKING + LEAD ROUTING
Branch: milestone/M009-crm-forms-booking
Model: claude-sonnet-4-6
Depends on: M003 complete (auth), M004 (theme for email templates)
Parallel: Can start after M003, parallel to M005+
Read: specs/crm.md (full spec)

GOAL: Full CRM, all forms, Cal.com booking, email engine, sequences,
      Twilio SMS, all 12 agencies pre-seeded with CRM data.

SLICES:

SLICE 1: CRM Core
  Task 1.1: CRM Postgres schema
    - contacts, accounts, deals, activities, tasks tables
    - All with agency_id + RLS
    - crm_sequences, crm_sequence_enrollments tables
    - crm_templates (email + SMS)
    - crm_scoring_weights (per agency, configurable)
    - crm_tags, crm_custom_fields
  Task 1.2: CRM React UI (in each agency app /admin/crm)
    - Pipeline kanban board (drag-drop stages, color by score)
    - Contact detail view (timeline, all activities)
    - Deal detail view (account, contacts, stage history)
    - Bulk actions (tag, email, export)
    - Cmd+K global search across contacts/deals
    - Mobile responsive full feature parity

  Task 1.3: Lead scoring engine (packages/crm)
    - Hybrid scoring: ICP fit (40%) + behavior (35%) + recency (15%) + source (10%)
    - Recalculates on every activity event
    - Score stored on contact + deal row
    - Score bands: 0-24 cold, 25-49 warm, 50-74 hot, 75-100 MQL

SLICE 2: Automations + Sequences
  Task 2.1: Workflow engine (BullMQ)
    - Trigger: form_submit, score_threshold, stage_change, no_activity_14d, etc
    - Actions: create_contact, send_email, create_task, notify_owner, enroll_sequence
    - Per-agency queue: agency:<id>:crm:workflow
    - All 12 default workflows pre-seeded per agency niche
  Task 2.2: Sequence engine
    - Multi-step email sequences (BullMQ scheduled jobs)
    - Enrollment check: no double-enrollment (check before enroll)
    - Unsubscribe check: stops marketing sequences only
    - Sequence state machine: enrolled -> step 1 -> step 2 -> ... -> complete
    - All 8 default sequences pre-seeded per agency

SLICE 3: Email Engine
  Task 3.1: Email sending (packages/email)
    - Postmark/SendGrid/SES adapter (BYO API key)
    - DKIM/SPF/DMARC validation in setup wizard before send-enable
    - Warm-up: 35-day ramp (50/day -> 500/day), sequences DRAFT mode
    - Bounce handling: hard bounce -> tag + suppress
    - Unsubscribe: one-click, honored within 10 minutes
  Task 3.2: Email templates
    - Payload collection: crm_templates (agency_id, type, subject, body)
    - Template editor in admin (Lexical-like, simpler)
    - Merge tags: {first_name}, {company}, {agency_name}, etc
    - All 10+ templates pre-seeded per agency (AI-drafted per niche)
    - Preview: render with sample data

SLICE 4: Forms + Lead Routing
  Task 4.1: Form builder
    - All form types pre-built (see specs/crm.md)
    - Spam protection: Turnstile + honeypot + email validation + disposable domain block
    - UTM capture: all 5 params + referrer + landing page
    - Self-reported: "How did you hear" dropdown
    - TCPA consent: checkbox (unchecked default), stored with timestamp
    - CRM hook: form submit -> contact created/updated -> sequence enrolled
  Task 4.2: Duplicate lead handling
    - Email match: update existing contact (no duplicate)
    - Phone match: flag for owner review
    - Lead-to-account match: email domain -> link to account
    - Merge tool: admin can merge two contacts

  Task 4.3: Lead routing + SLA
    - All leads -> owner (v1, single owner)
    - 4h SLA timer starts on new lead creation
    - Owner notification: email + Slack webhook
    - SLA breach at 4h: escalation email + task flagged overdue

SLICE 5: Cal.com Booking Integration
  Task 5.1: Cal.com self-hosted setup
    - White-labeled per agency (agency logo, theme tokens)
    - 6 meeting types pre-seeded per agency
    - Payment at booking: Stripe/PayPal deposit optional
    - Embed: Cal.com inline on /book page + CTA blocks
  Task 5.2: CRM sync (webhooks)
    - Booking created: contact updated, activity logged, deal stage -> Discovery booked
    - Meeting completed: outcome prompt, follow-up task created
    - No-show: tagged, reschedule sequence, score -5
    - Cancelled: activity logged, nurture resumed
    - HMAC signature verification on all Cal.com webhooks (SEC-N11)
  Task 5.3: Reminder sequences
    - 24h before: email + SMS
    - 1h before: SMS only
    - 5min after start (no-show): "Missed you" reschedule email
    - All copy pre-seeded per agency (AI-drafted)

SLICE 6: Twilio SMS
  Task 6.1: SMS engine
    - Twilio client (packages/crm/sms)
    - TCPA: check sms_opt_in = true before ANY send
    - STOP keyword handler: webhook -> sms_opt_in = false immediately
    - 10DLC compliance setup wizard step
    - All 5 SMS templates pre-seeded per agency
  Task 6.2: SMS sequences
    - Integrated with email sequence engine
    - Booking reminders (1h before)
    - Form submit confirmation (within 60s)

SLICE 7: Pre-seeded CRM Data (all 12 agencies)
  Task 7.1: Seed all CRM data per agency
    - Pipeline stages (9 default + niche overrides)
    - Tags (30 per agency)
    - Custom fields (10 per agency)
    - Email templates (10+ per agency, AI-drafted per niche)
    - SMS templates (5 per agency)
    - Sequences (8 per agency)
    - Workflows (12 per agency)
    - Scoring weights (niche-specific)
    - Meeting types (6 per agency, Cal.com)

SUCCESS CRITERIA:
  Form submit -> contact in CRM (Playwright e2e test)
  4h SLA timer starts + owner notified (integration test)
  Cal.com booking -> CRM activity logged (webhook test)
  Email: DKIM/SPF/DMARC valid in setup wizard
  SMS: STOP keyword sets opt-in to false immediately (test)
  Duplicate lead: second submit updates existing, no duplicate (test)
  All 12 agencies: CRM pre-seeded and verified
  Webhook signature verification: invalid sig returns 200 + no processing
  Stripe event idempotency: duplicate webhook skipped (Redis test)

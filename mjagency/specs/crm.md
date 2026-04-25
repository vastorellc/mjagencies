specs/crm.md - MJAgency CRM + Revenue Spec

==============================================================
CRM ARCHITECTURE
==============================================================
Per-agency CRM. Own Postgres DB. Isolated.
Single agency owner at v1. Multi-rep routing ready for v2.
BullMQ for all async operations (sequences, notifications).

Object model:
  contacts     - Individual people (email, phone, company, tags)
  accounts     - Companies (name, website, industry, size)
  deals        - Opportunities (stage, value, contacts, activities)
  activities   - All interactions (email, call, SMS, meeting, note)
  tasks        - Follow-up actions (due date, priority, owner)
  sequences    - Multi-step automated outreach
  templates    - Email + SMS templates

==============================================================
DEFAULT PIPELINE (PRE-SEEDED, CUSTOMIZABLE)
==============================================================
Stage 1: New lead           - Form/tool submit, contacted within 4h
Stage 2: Contacted          - First outreach made
Stage 3: Qualifying         - ICP fit + budget + timeline confirmed
Stage 4: Discovery booked   - Meeting scheduled
Stage 5: Proposal sent      - Pitch + pricing delivered
Stage 6: Negotiation        - Terms being finalized
Stage 7: Won                - Contract signed, invoice issued
Stage 8: Lost               - Disqualified (reason logged)
Stage 9: Nurture            - Not ready, re-engage in 30/60/90d

Proposal expired substage: between Proposal Sent and Lost
  - Fires after 14 days no response
  - Owner notified, 7-day grace period
  - Then auto-moves to Nurture (NOT Lost)

Days-in-stage tracking:
  - Alert if deal exceeds 2x average for that stage
  - Owner receives daily digest of stalling deals

==============================================================
LEAD SCORING (HYBRID, PRE-SEEDED PER NICHE)
==============================================================
ICP fit (firmographic):     40% weight
Engagement (behavior):      35% weight
Recency:                    15% weight
Source quality:             10% weight

Score bands:
  0-24:   Cold, nurture sequence enrolled
  25-49:  Warm, 3-touch sequence
  50-74:  Hot, owner notified, 4h follow-up task created
  75-100: MQL, auto-task: phone call

Score recalculates on every activity.
Niche overrides: finance weights firmographic higher,
                 video weights creative-brief activity higher.

==============================================================
LEAD ROUTING (V1 - SINGLE OWNER)
==============================================================
All leads -> owner (default)
4h SLA first response
SLA breach: escalation email + Slack alert + task flagged overdue

Multi-rep routing: structure ready, disabled at v1.
Round-robin, territory, score-based: activatable post-v1.

==============================================================
AUTOMATIONS (ALL PRE-SEEDED)
==============================================================
On form submit:
  - Create contact + deal in New stage
  - Auto-tag source + service interest
  - Enrich via Clearbit/Apollo (BYO API key)
  - Assign to owner
  - Send confirmation email (branded, per niche)
  - Start 4h SLA countdown
  - Owner notification (email + Slack)
  - Create 4h follow-up task

On tool result submitted:
  - Same as form submit + attach result PDF to contact

On email reply detected:
  - Move Contacted -> Qualifying
  - Cancel active sequence
  - Alert owner

On score >= 50:
  - Notify owner
  - Create call task
  - Priority highlight in dashboard

On no activity 14d (any stage):
  - Auto-nudge sequence starts

On deal Won (e-sign complete):
  - Invoice creation triggered
  - Onboarding email sequence starts
  - Case study capture flag created
  - Client folder created

On deal Lost:
  - Win/loss survey sent
  - If reason = timing: move to Nurture

On Nurture deal:
  - Re-engagement sequence (30/60/90d cadence)
  - Auto-recycles to New on re-engage signal

On email bounce (hard):
  - Tag email-invalid
  - Pause all sequences for contact
  - Owner notified

On unsubscribe:
  - Tag unsubscribed:marketing
  - Stop all marketing sequences
  - Transactional emails continue (booking confirmations, invoices)
  - NEVER stop transactional

==============================================================
EMAIL SEQUENCES (PRE-SEEDED, 8 PER AGENCY)
==============================================================
1. New lead nurture (5 emails, 14 days)
2. Re-engagement 30d (3 emails, 7 days)
3. Re-engagement 60d (2 emails, 5 days)
4. Re-engagement 90d (1 email - last touch)
5. Proposal follow-up (3 emails, 10 days)
6. Won-deal onboarding (4 emails, 7 days)
7. Lost-deal win-back (quarterly, 1 email)
8. Tool result follow-up (4 emails, 14 days)

All copy: AI-drafted per niche, brand voice loaded.

Sequence enrollment rule:
  If contact already active in a sequence: do NOT enroll in second.
  Queue second sequence to start after first completes.
  Owner configures priority in admin.

==============================================================
DUPLICATE LEAD HANDLING
==============================================================
On form submit:
  1. Check contacts table: email = ? per agency
  2. Match found: update activity + log new form submit (NO duplicate)
  3. No match: create new contact
  4. Phone match secondary: flag for owner review
  5. Email domain match: check accounts table, link if found
  6. Same IP, 3+ submits in 1h: rate-limit + flag spam

Merge tool: admin can merge two contacts (activities combined).

==============================================================
EMAIL DELIVERABILITY
==============================================================
Sending domain: mail.<agency>.brand.com recommended in wizard.
DKIM + SPF + DMARC validated in setup wizard before send-enable.
Warm-up: 35-day mandatory. Ramp 50/day -> 500/day.
Sequences stay DRAFT for 35 days post-domain-setup.
Owner activates manually after warm-up completes.

Sender reputation monitoring:
  Daily blacklist check
  Alert on hit
  Bounce handling: hard bounces tagged, suppressed
  Complaint handling: auto-suppress on spam complaint
  Content scan before send: spam trigger words, suspicious links

==============================================================
FORMS
==============================================================
Form types (all pre-seeded with real copy per niche):
  contact-general      Name, email, phone, message, "how did you hear"
  service-inquiry      Name, email, phone, service, budget, timeline
  tool-result-capture  Email, name (optional), consent
  pricing-quote        Name, email, company, service, budget
  newsletter-signup    Email only
  callback-request     Name, phone, best time

UX rules:
  Multi-step (2-3 steps max, progress bar)
  Mobile-first (48px tap targets, autocomplete)
  Inline validation (real-time, not submit-and-fail)
  Error messages: human + specific
  CLS = 0 (fields reserve space before JS loads)
  Accessible: labels always visible, ARIA, keyboard-navigable

Spam protection (7 layers):
  1. Cloudflare Turnstile (invisible, no user friction)
  2. Honeypot field (hidden, bots fill it)
  3. Email syntax + MX record validation
  4. Disposable email domain blocklist
  5. Rate limiting (5 submits/IP/hour)
  6. Keyword filter on message field
  7. US-only IP filter (v1)

UTM capture on every submit:
  utm_source, utm_medium, utm_campaign, utm_content, utm_term
  referrer_url, landing_page, session_id
  "How did you hear" dropdown (self-reported attribution)

==============================================================
BOOKING (CAL.COM)
==============================================================
Cal.com: self-hosted, white-labeled per agency, theme tokens applied.
Payment at booking: Stripe + PayPal deposit optional per meeting type.

Meeting types (pre-seeded per agency):
  Discovery call (30 min)
  Strategy session (60 min)
  Proposal review (45 min)
  Onboarding kickoff (60 min)
  Check-in / support (30 min)
  Custom (owner adds)

Availability defaults:
  Mon-Fri, 9am-5pm (agency timezone)
  15 min buffer between meetings
  Max 5 meetings/day (configurable)
  4h minimum notice
  30 days max advance booking
  Timezone: auto-detected from visitor browser

CRM sync on booking events:
  Booked:    contact updated, activity logged, deal -> Discovery booked, owner notified
  Completed: outcome prompt to owner, follow-up task created
  No-show:   tagged no-show, reschedule sequence, score -5
  Cancelled: activity logged, nurture resumed

Reminder sequence:
  Immediately: confirmation email + calendar invite + video link
  24h before:  email + SMS
  1h before:   SMS only
  5min after start (no-show): "Missed you" email

==============================================================
PROPOSALS + E-SIGN + INVOICING
==============================================================
Full flow:
  Won deal -> Pitch deck built -> Proposal sent -> Client views
  -> E-sign -> Deposit invoice auto-sent -> Payment
  -> Project kickoff -> Progress invoices -> Final invoice
  -> Paid -> Case study flag

Proposal:
  Hosted at: agency.brand.com/proposals/<slug>
  Password optional
  Sections: summary, scope, deliverables, timeline, investment, terms, e-sign
  View tracking: time-on-page, sections viewed, forwarded detection
  Expiry: 14 days default (configurable)
  Expiry with no action: -> Proposal Expired substage -> 7d grace -> Nurture
  AI generation: owner fills brief -> AI drafts full proposal (Sonnet)

E-sign:
  Custom built (no DocuSign/HelloSign)
  ESIGN Act (US) compliant
  Client draws or types signature
  Email verification before signing
  Signed PDF: signature overlay + timestamp + IP + email
  Storage: R2 (proposals/<agencyId>/<dealId>/signed-<timestamp>.pdf)
  Both parties emailed signed PDF
  Audit trail: signer name, email, IP, timestamp, intent
  Counter-sign: owner counter-signs if configured

Invoicing (Stripe primary, PayPal secondary):
  Types: deposit, milestone, recurring retainer, final, ad-hoc
  Trigger: e-sign complete -> deposit invoice auto-generated + sent
  Stripe fees: 0.4% per invoice (capped $2) + 2.9%+30c card / 0.8% ACH
  ACH encouraged for large invoices
  Due date: Net 7 default (configurable)
  Reminders: 3d before, on due date, 3d after, 7d after
  Dunning: escalating sequence, owner notified at 14d overdue
  Partial payment: supported, balance tracked in CRM

Invoice states:
  draft -> sent -> viewed -> paid -> refunded -> disputed

Invoice partial payment:
  0%:   CRM deal in Won, invoice sent
  1-99%: invoice partial, balance tracked, owner notified
  50%+:  deal moves to Active Project substage
  100%:  invoice paid, next milestone queued, case study flag created

Refund flow:
  Owner initiates via Stripe dashboard or CRM action
  Invoice state -> refunded or partial_refund
  Client receives refund confirmation email
  No self-serve client refund portal at v1

Chargeback flow:
  stripe.charge.dispute.created webhook -> owner notified
  Deal flagged disputed
  Auto-compile evidence: proposal PDF + e-sign audit + email logs
  Evidence packet ready for Stripe dispute portal
  Dispute won: invoice returns to paid
  Dispute lost: invoice -> charged_back, owner reviews

Stripe webhook idempotency:
  Redis key: stripe:event:<eventId> (TTL 24h)
  Check before processing
  Already processed: return 200, skip

==============================================================
CRM COMPLIANCE
==============================================================
TCPA (SMS):
  Opt-in required (checkbox on form, unchecked by default)
  Consent stored: sms_opt_in = true/false + timestamp
  STOP keyword: auto-sets sms_opt_in = false immediately
  No SMS without confirmed opt-in (sequence checks before enroll)

CAN-SPAM:
  Unsubscribe in every marketing email
  Physical address in footer
  Honest From address
  No deceptive subject lines

CCPA:
  Subject can request data export + erasure
  30-day response window
  Auto-purge schedule after consented period

FTC testimonials:
  Real testimonials only (with permission)
  Composite playbooks: disclaimer required
  Disclaimer text: "Results depicted are composite examples based on
  typical outcomes for clients in this industry. Individual results vary.
  These are not testimonials from specific clients."

Agency owner cannot self-delete account:
  Only super_admin can delete owner account
  Must transfer ownership first (or full agency archive)

==============================================================
CHATBOT (V1 SCOPE)
==============================================================
V1: Rule-based guided qualification chatbot (no LLM at v1 = cost + reliability)
Model: Finite state machine (states stored in sessionStorage)

Flow:
  1. Greeting -> ask intent (service / tool / pricing / talk to someone)
  2. Based on intent: ask service interest
  3. Ask business state (US state dropdown)
  4. Ask pain point or timeline
  5. Offer: Book a call / Get a price / Use a tool
  6. On email capture: create contact in CRM

Implementation:
  React component (packages/ui/chat)
  State machine: xstate or simple switch/case
  Lead capture: POST /api/crm/chat-lead -> same as form submit
  Analytics: chat_flow_completed event to GA4
  Persistent: sessionStorage (resets on new session)

V2 additions: LLM-powered responses, sentiment detection, handoff to live chat.

==============================================================
MISSING BL DECISIONS (FROM AUDIT - ALL FIXED)
==============================================================
BL-N3: Signed PDF storage
  On e-sign complete:
    1. Generate signed PDF (React-PDF or Puppeteer)
    2. Signature overlay: visual signature + timestamp + signer email + IP
    3. Store: R2 at proposals/<agencyId>/<dealId>/signed-<timestamp>.pdf
    4. Permissions vault: link PDF to deal record
    5. Email: both parties receive PDF (agency email + client email)
    6. Client portal: /portal/<signedUrlToken> (30d expiry, read-only)

BL-N4: Tool PDF re-send
  On tool PDF capture:
    1. Save PDF to R2: tools/<agencyId>/<toolSlug>/<sessionId>.pdf
    2. Show shareable link (30d signed URL) on confirmation page
    3. Re-send button: user enters email again, PDF re-delivered
    4. No separate indexed URL for result

BL-N5: Sequence enrollment conflict
  Rule: if contact already active in any sequence -> do not enroll in second
  Implementation:
    Before enroll: check crm_sequence_enrollments where contact_id = ? AND status = 'active'
    If found: queue second sequence to start after first completes
    crm_sequence_enrollments.queued_sequences: jsonb array of pending sequence IDs
  Admin can override: force-enroll overrides active check

BL-N7: Agency owner self-delete prevention
  Payload access control:
    users collection, delete operation:
      access: { delete: ({ req }) => req.user?.role === 'super_admin' }
  Admin UI: "Delete Account" button hidden from admin role in UI
  API: DELETE /api/users/:id returns 403 if actor = target AND role = 'admin'

BL-N8: Multi-touch attribution (final rule)
  contact.first_touch_source: set on first contact creation, never changes
  contact.last_touch_source: updated on every new activity
  deal.all_touches: append-only array of all touchpoints
  CRM: not an attribution tool. Records events only.
  GA4: linear attribution model handles campaign math.
  Reports: CRM shows first/last touch. GA4 shows linear attribution.

BL-N9: Email warm-up timing
  Domain setup: must be done BEFORE M012 seed (do in M009)
  Warm-up starts: on DNS verification of DKIM/SPF/DMARC
  Duration: 35 days minimum
  Ramp: 50/day -> 100 -> 200 -> 350 -> 500 (weekly increases)
  Sequences status: DRAFT mode until warm-up flag set to complete
  Owner activates: admin/settings/email-warmup -> "Activate sequences" button
  Reminder: day-35 email to owner: "Your warm-up is complete. Activate sequences."

==============================================================
CRM ADMIN UI COMPLETENESS
==============================================================
Required admin views:
  /admin/crm/contacts         Contact list (sortable, filterable, bulk actions)
  /admin/crm/contacts/:id     Contact detail (timeline, deals, tasks)
  /admin/crm/accounts         Account list
  /admin/crm/deals            Pipeline kanban (drag-drop stages)
  /admin/crm/deals/:id        Deal detail (proposal link, invoice link, activity)
  /admin/crm/tasks            Task board (by due date, by priority)
  /admin/crm/sequences        Sequence builder (steps, delays, conditions)
  /admin/crm/templates        Email/SMS template library
  /admin/crm/analytics        Lead volume, conversion rates, SLA compliance
  /admin/crm/settings         Scoring weights, pipeline stages, custom fields

Global CRM search (Cmd+K):
  Searches: contacts (name, email, company) + deals (name, company) + tasks (title)
  Results: max 10 per type, shows source label
  Keyboard navigable: arrow keys + enter to navigate + open

Mobile CRM:
  Full feature parity on mobile (not a cut-down view)
  48px touch targets on all interactive elements
  Swipe actions: swipe deal card left (won/lost quick actions)

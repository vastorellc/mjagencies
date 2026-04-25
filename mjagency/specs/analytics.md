specs/analytics.md - MJAgency Analytics + Compliance Spec

==============================================================
ANALYTICS STACK
==============================================================
GA4 + GTM (server-side)     Primary web analytics
Cloudflare Web Analytics    Privacy-first RUM, no cookies needed
Microsoft Clarity           Session replay, heatmaps, rage clicks
OpenTelemetry               Server-side traces, backend performance
Prometheus + Grafana        Infrastructure metrics, uptime
Loki                        Log aggregation, error tracking
Meta CAPI                   Server-side conversion events
Custom RUM script           web-vitals library, LCP/INP/CLS per page

==============================================================
GA4 EVENT TAXONOMY (PRE-CONFIGURED GTM CONTAINER)
==============================================================
page_view               Every page load
form_start              First field interaction
form_submit             Successful submit
form_error              Validation failure
tool_start              Tool first input
tool_complete           Result rendered
tool_lead_captured      PDF email submitted
proposal_viewed         Client opens proposal link
proposal_accepted       E-sign complete
invoice_paid            Stripe webhook -> GA4 event
booking_made            Cal.com webhook
booking_noshow          Cal.com webhook
cta_click               Any CTA with data-cta attribute
scroll_depth            25/50/75/100% per page
video_play              Play button clicked
video_complete          90%+ watched
rum_lcp                 Custom RUM via Measurement Protocol
rum_inp                 Custom RUM via Measurement Protocol
rum_cls                 Custom RUM via Measurement Protocol

GTM container: pre-configured, exported as JSON, imports in 1 click.

==============================================================
SERVER-SIDE TRACKING
==============================================================
Problem: Cookie loss from Safari ITP and ad blockers
Solution: GTM server-side container on own subdomain
  analytics.brand.com -> GTM server-side container
  First-party cookies set server-side (1yr expiry, not blocked)

Meta CAPI server-side:
  Match on email hash (no cookie dependency)
  Conversion events fired server-side
  No reliance on browser pixel

GA4 Measurement Protocol:
  Conversion events fired server-side
  Supplements browser tracking

==============================================================
RUM (REAL USER MONITORING)
==============================================================
Library: web-vitals (Google official, ~5KB async, zero blocking)
Metrics: LCP, INP, CLS, FCP, TTFB
Granularity: per-URL, per-device, per-browser, per-connection
Target: p75 (75th percentile, not average)

Thresholds:
  LCP: <1.8s good / <2.5s needs work / >2.5s poor
  INP: <200ms good / <500ms needs work / >500ms poor
  CLS: <0.1 good / <0.25 needs work / >0.25 poor
  TTFB: <800ms good / <1800ms needs work

Sends to: GA4 custom events + internal rum_events table (Postgres)
Sampling: 100% default, configurable down to 10% for high traffic
Privacy: No PII, no cookies, IP anonymized, CCPA-safe
Reduced motion: not tracked as interaction

Alerts:
  Regression: p75 shifts >15% vs 7-day baseline -> Email + Slack
  Uptime <99.9%: PagerDuty + Slack
  Error rate >1%: Slack

==============================================================
MICROSOFT CLARITY
==============================================================
Free, unlimited sessions
Session replay: watch real user sessions, identify UX friction
Heatmaps: click, scroll, attention per page
Rage click detection: flag pages with frustrated clicking
Dead click detection: flag broken CTA buttons
Privacy: auto-masks form fields, PII redacted
Integration: GA4 events via GTM

==============================================================
DASHBOARDS (PER ROLE)
==============================================================
Platform overview (super_admin):
  All 12 agencies traffic, conversions, revenue
  Core Web Vitals per agency
  Server health, uptime, error rates
  Asset cost per agency
  Content coverage % per agency

Per-agency marketing (admin):
  Traffic by source, campaign, page
  Conversions: forms, tool completions, bookings
  Lead volume, score distribution
  Email deliverability rates
  CWV per page

Per-agency revenue (admin):
  Pipeline value by stage
  Deals: proposals sent, signed, won, lost
  Invoice: sent, paid, outstanding, overdue
  Deal-to-cash time
  MRR/ARR if retainer clients

Per-agency CRM (admin):
  Lead volume (daily/weekly/monthly)
  Sequence performance (open rates, reply rates)
  SLA compliance (4h first response)
  Meeting booked/show rates
  Tool conversion rate

Performance / RUM (super_admin + admin):
  LCP/INP/CLS per page
  Regression history
  Device breakdown (mobile vs desktop)
  Browser breakdown

==============================================================
MULTI-TOUCH ATTRIBUTION
==============================================================
Model: First-touch + last-touch + linear (all three stored)
CRM: Records events (not attribution tool)
GA4: Handles attribution math (linear default)
Self-reported: "How did you hear" always captured

Multi-touch conflict rule:
  contact.first_touch_source: stored on first contact creation (never changes)
  contact.last_touch_source: updated on every new activity
  deal.all_touches: array of all touchpoints
  GA4: linear attribution model for campaign reporting
  CRM: not attribution tool, records events only

==============================================================
COMPLIANCE
==============================================================
CCPA:
  Consent mode v2 in GTM
  Data export tooling for subject requests
  Data deletion workflow (30-day response)
  Opt-out honored (no personal data sale)
  CCPA disclosure in Privacy Policy

GDPR-ready:
  Same structure as CCPA
  Data residency: US-based servers
  Structure ready for EU expansion
  Consent mode v2 handles EU consent automatically

Cookie consent:
  Cloudflare Web Analytics: no consent banner needed (no cookies, no tracking)
  GA4: consent mode v2 (signals not set = limited data mode)
  Non-essential cookies: require consent

ADA / WCAG 2.2 AA:
  axe-core CI scan (zero critical violations required)
  Keyboard navigation tested on all P0 pages
  Screen reader labels on all interactive elements
  Color contrast: 4.5:1 small text, 3:1 large text
  Focus ring: visible on all interactive elements
  Reduced motion: all animations respect prefers-reduced-motion

FTC compliance:
  Testimonials: real + permission + attribution
  Composite playbooks: mandatory disclaimer
  AI-generated content: disclosed when >70%
  Sponsored content: rel="sponsored"
  Affiliate links: rel="sponsored" (not applicable at v1)

Email compliance:
  CAN-SPAM: unsubscribe in every marketing email
  TCPA: SMS opt-in required, STOP honored
  DKIM/SPF/DMARC: validated before send-enable
  Warm-up: 35 days before sequences activate

==============================================================
COST TRACKING
==============================================================
Per agency:
  Storage: R2 bytes per agency
  Bandwidth: CDN bandwidth per agency
  Image transforms: CF Images calls per agency
  Video encoding: CF Stream minutes per agency
  AI usage: LiteLLM token cost per agency
  Email sending: per-email cost per agency

Super_admin cost dashboard:
  Monthly rollup per agency
  Most expensive assets (hot list)
  Budget alerts (configurable thresholds)
  Year-over-year comparison

==============================================================
SLA COMMITMENTS
==============================================================
Public site uptime:    99.9% per month
Admin panel uptime:    99.5% per month
RPO:                   1 hour (WAL + hourly snapshots)
RTO:                   4 hours (backup restore runbook)
First response (leads): 4 hours business hours
Cache purge after publish: <60 seconds
Deployment (canary):   <30 minutes end-to-end
DB migration per agency: <5 minutes
Seed per agency:       <15 minutes
Incident post-mortem:  Within 48 hours of resolution

==============================================================
COST TRACKING (DETAILED)
==============================================================
Per-agency monthly cost breakdown tracked in admin:

Storage costs:
  R2 storage: bytes used x $0.015/GB
  Cloudflare Images: transforms x $0.001/1K
  Cloudflare Stream: minutes stored x $0.005

Bandwidth costs:
  CDN bandwidth: egress GB x Cloudflare tier rate
  Stream delivery: minutes served x $0.001

AI usage costs (LiteLLM tracks per agency):
  Flash-Lite calls: input+output tokens x $0.10/$0.40 per M
  Sonnet calls: input+output tokens x $3/$15 per M
  Opus calls: input+output tokens x $5/$25 per M
  Budget cap alert: at 80% of monthly cap -> email admin

Email costs (per-agency, tracked externally):
  Postmark/SendGrid/SES: varies by provider, per-email estimate shown

Total monthly estimate:
  Light agency (1-5K visitors): ~$25-60/month platform costs
  Medium agency (10-50K visitors): ~$80-200/month
  Heavy agency (100K+ visitors): ~$300+/month
  AI costs scale with content updates and tool usage

Cost dashboard location:
  Admin: /admin/settings/usage (per-agency)
  Super_admin: /admin/platform/costs (all agencies)
  Data source: direct API calls to Cloudflare + LiteLLM usage API
  Refresh: daily (not real-time)
  Alert: super_admin email if any agency exceeds configured threshold

==============================================================
MISSING INTEGRATIONS THAT NEED SETUP WIZARD STEP
==============================================================
Google Search Console (GSC):
  Owner connects GSC property in setup wizard
  API key stored in agency_settings
  Used by SEO self-learning loop (M006)
  Fallback: self-learning loop disabled until connected

Google Analytics 4 (GA4):
  Measurement ID stored in agency_settings
  Auto-configured via GTM server-side container
  No code change needed per agency (config-driven)

Meta Pixel / CAPI:
  Pixel ID + CAPI access token stored in agency_settings
  Server-side CAPI fires on form submit, booking, invoice paid

Slack webhook (for owner alerts):
  Optional, stored in agency_settings
  Used for: SLA breach, score >=50 lead, failed backup, algorithm change

==============================================================
DATA RETENTION POLICY
==============================================================
rum_events:          90 days (rolling delete)
crm_activities:      7 years (ESIGN compliance)
audit_log:           7 years (immutable)
ga4 raw data:        Google's retention (14 months default)
error logs (Loki):   30 days
traces (Tempo):      14 days
backups (R2):        30 days full, 7 days WAL
email delivery logs: 90 days
session data:        7 days (refresh token TTL)

MILESTONE M011 - ANALYTICS + RUM + COMPLIANCE + SECURITY HARDENING
Branch: milestone/M011-analytics-compliance-security
Model: claude-sonnet-4-6
Depends on: M010 complete
Read: specs/analytics.md (full), specs/security.md (all hardening items)

GOAL: GA4, Clarity, RUM dashboards fully functional. CCPA compliant.
      WAF rules active. OWASP ZAP scan clean. CSP hardened.

SLICES:

SLICE 1: GA4 + GTM Server-Side
  Task 1.1: GTM server-side container
    - Deploy to analytics.brand.com (Cloudflare Worker or Node server)
    - First-party cookies set server-side (1yr expiry, not blocked by ITP)
    - All GA4 events routed through server container
    - GTM container JSON (pre-configured): import in 1 click
  Task 1.2: All GA4 events wired (see specs/analytics.md for full list)
    - page_view, form_start, form_submit, form_error
    - tool_start, tool_complete, tool_lead_captured
    - proposal_viewed, proposal_accepted
    - invoice_paid (Stripe webhook -> Measurement Protocol)
    - booking_made, booking_noshow (Cal.com webhook -> GA4)
    - cta_click (data-cta attribute on all CTAs)
    - scroll_depth (25/50/75/100%)
    - rum_lcp, rum_inp, rum_cls (Measurement Protocol)

SLICE 2: Microsoft Clarity + Meta CAPI
  Task 2.1: Clarity setup
    - Clarity snippet in GTM (not inline in layout)
    - Auto-masking: all form inputs masked by default
    - PII redaction: confirmed in Clarity privacy settings
    - Integration: Clarity custom events -> GA4 via GTM
  Task 2.2: Meta CAPI server-side
    - Meta Conversions API (server-side pixel)
    - Match on email hash SHA-256 (no cookie dependency)
    - Events: form submits, tool completions, bookings
    - Test Events Tool: verify events in Meta Business Manager

SLICE 3: RUM Dashboard + Alerts
  Task 3.1: rum_events table consumers
    - Per-agency RUM dashboard: LCP/INP/CLS per page
    - Device breakdown (mobile vs desktop percentiles)
    - Regression detection: p75 shift >15% vs 7-day baseline
    - Alert: regression detected -> email + Slack
  Task 3.2: Analytics dashboards in admin
    - Platform overview (super_admin): all 12 agencies
    - Per-agency marketing: traffic, sources, conversions
    - Per-agency revenue: pipeline, deals, invoices
    - Per-agency CRM: lead volume, sequences, SLA
    - See specs/analytics.md for all dashboard specs
  Task 3.3: Cost dashboard
    - Per-agency: storage, bandwidth, AI usage, email sending
    - Budget alerts: configurable thresholds
    - Monthly rollup visible to admin

SLICE 4: CCPA + Compliance
  Task 4.1: CCPA tooling
    - Data export: admin can export contact data as JSON/CSV (30d response SLA)
    - Data deletion: full erasure workflow (contacts, activities, deals)
    - Opt-out: contact opt-out of data sale (consent_status field)
    - Privacy policy page: pre-seeded, CCPA-compliant language
  Task 4.2: Cookie consent
    - Cloudflare Web Analytics: no consent needed (no cookies)
    - GA4: consent mode v2 (signals not set = limited data mode)
    - Non-essential cookies: user consent required via banner
    - Banner: minimal, non-intrusive, CTA-less design

SLICE 5: Security Hardening
  Task 5.1: CSP nonce implementation
    - Per-request nonce: crypto.getRandomValues(new Uint8Array(16))
    - Injected via Cloudflare Worker before HTML response
    - All inline styles receive nonce prop (Lexical + Puck)
    - style-src: 'nonce-{X}' 'self'
    - script-src: 'nonce-{X}' 'self'
  Task 5.2: Security headers audit
    - All headers verified on all routes (automated check)
    - HSTS: max-age=31536000; includeSubDomains; preload
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: camera=(), microphone=(), geolocation=()
  Task 5.3: WAF rules
    - Cloudflare managed ruleset: enabled
    - Custom rule: /admin accessible from whitelisted IPs only
    - Rate limits: per agency, per endpoint
    - Bot detection: Turnstile on all forms
  Task 5.4: OWASP ZAP scan
    - Run OWASP ZAP in CI (Docker mode)
    - Target: all P0 pages + all API endpoints
    - Zero high-severity findings required
    - Zero medium-severity findings on auth routes
    - Fix any findings before M012

SLICE 6: Error Tracking + Uptime
  Task 6.1: Error tracking
    - Sentry integration (or self-hosted Glitchtip)
    - Frontend errors -> Sentry with agency context
    - Server errors -> Sentry + Loki
    - Error rate dashboard in Grafana
  Task 6.2: Uptime monitoring
    - Prometheus: health endpoints per agency (/api/health)
    - Alert: any agency uptime <99.9%: PagerDuty + Slack
    - Status page: simple /status route per agency

SUCCESS CRITERIA:
  GA4 events visible in debug view for all P0 actions
  Clarity: session recordings visible in dashboard
  Meta CAPI: test events pass in Meta Events Manager
  RUM: LCP/INP/CLS visible per page in dashboard
  CCPA: data export + deletion both work end-to-end
  CSP: nonce present on all inline styles (browser DevTools verify)
  OWASP ZAP: zero high-severity findings on all targets
  Security headers: all present on all routes (automated check)
  Uptime alert: test alert fires when health endpoint returns 500
  Cost dashboard: per-agency costs visible to admin

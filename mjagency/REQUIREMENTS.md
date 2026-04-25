REQUIREMENTS.md - MJAgency Traceable Requirements

Format: REQ-NNN | Description | Milestone | Priority

==============================================================
INFRASTRUCTURE
==============================================================
REQ-001 | Turborepo monorepo with 12 agency apps + shared packages | M001 | P0
REQ-002 | Docker Compose for local dev (13 Postgres, Redis, Mailhog) | M001 | P0
REQ-003 | Cloudflare Images + Stream + R2 + Workers + WAF | M001 | P0
REQ-004 | OpenTelemetry traces across all services | M001 | P1
REQ-005 | GitHub Actions CI/CD with canary gate | M001 | P0
REQ-006 | VPS: 8GB RAM minimum, 4GB swap | M001 | P0
REQ-007 | PM2 cluster mode per agency app | M001 | P0

==============================================================
DATABASE
==============================================================
REQ-010 | Per-agency PostgreSQL 17 database (13 total) | M002 | P0
REQ-011 | PgBouncer per agency, transaction mode, pool_size=20 | M002 | P0
REQ-012 | Drizzle ORM with strict TypeScript types | M002 | P0
REQ-013 | Row-level security on all agency-scoped tables | M002 | P0
REQ-014 | agency_id immutable after creation | M002 | P0
REQ-015 | Migration runner: parallel, dry-run, canary, rollback | M002 | P0
REQ-016 | Seed scripts: transactional, resume on fail | M002 | P0
REQ-017 | Backup: hourly WAL + snapshots, R2 upload, quarterly DR | M002 | P0
REQ-018 | Permissions vault (encrypted, 7yr retention) | M002 | P0
REQ-019 | Audit log: hash-chained, append-only | M002 | P0

==============================================================
AUTHENTICATION
==============================================================
REQ-020 | JWT using jose library ONLY (never jsonwebtoken) | M003 | P0
REQ-021 | Access token: 15min TTL, iss=mjagency, aud=mjagency-api | M003 | P0
REQ-022 | Refresh token: 7d TTL, one-time use, family revocation | M003 | P0
REQ-023 | Tokens in httpOnly + SameSite=Strict + Secure cookies | M003 | P0
REQ-024 | MFA mandatory for super_admin + admin roles | M003 | P0
REQ-025 | TOTP + 8 one-time recovery codes | M003 | P0
REQ-026 | SSO at accounts.brand.com | M003 | P1
REQ-027 | Session regeneration on privilege escalation | M003 | P0
REQ-028 | Agency owner cannot self-delete account | M003 | P0
REQ-029 | Next.js version >= 15.2.3 (CVE-2025-29927 patch) | M003 | P0
REQ-030 | Cloudflare middleware excludes /admin and /api routes | M003 | P0
REQ-031 | Every server action: auth check as first line | M003 | P0

==============================================================
DESIGN SYSTEM
==============================================================
REQ-040 | CSS variable token schema (6 layers) | M004 | P0
REQ-041 | theme.json manifest + JSON Schema validator | M004 | P0
REQ-042 | 20 customization scopes per agency | M004 | P0
REQ-043 | Theme resolution: base -> agency -> page | M004 | P0
REQ-044 | 12 niche default themes pre-built | M004 | P0
REQ-045 | Theme switch < 16ms (CSS variable update) | M004 | P0
REQ-046 | Dark mode via token swap, no asset reload | M004 | P0
REQ-047 | SVG illustrations: token vars, no hex literals | M004 | P0
REQ-048 | Storybook: one story per block (45 blocks), all 12 niche themes, visual regression CI | M004 | P1

==============================================================
CMS
==============================================================
REQ-050 | Payload CMS 3.82.1 EXACTLY (pinned) | M005 | P0
REQ-051 | Embedded model: Payload inside Next.js via withPayload() | M005 | P0
REQ-052 | 45 blocks across 11 categories | M005 | P0
REQ-053 | Lexical editor: full toolbar (H1-H6, bold, color, link, table, etc) | M005 | P0
REQ-054 | Lexical: fixed toolbar + inline toolbar both enabled | M005 | P0
REQ-055 | SEO/AIO/GEO panel in CMS editor sidebar (real-time scoring) | M005 | P0
REQ-056 | Draft -> review -> publish workflow | M005 | P0
REQ-057 | Scheduled publishing via BullMQ | M005 | P0
REQ-058 | 20 rolling revisions per content item | M005 | P0
REQ-059 | Global blocks (edit once, propagate everywhere) | M005 | P0
REQ-060 | DAM: 3 views (super_admin, admin, editor picker) | M005 | P0
REQ-061 | DAM: text + semantic + visual + color search | M005 | P0
REQ-062 | Brand portal (external partner access, signed links) | M005 | P1
REQ-063 | Living brand book per agency (auto-rendered from tokens) | M005 | P1

==============================================================
SEO / AIO / GEO
==============================================================
REQ-070 | 3 SEO plugins: seo-classic, aio-citations, geo-chunking | M006 | P0
REQ-071 | Plugin runtime: all weights/rules editable in admin (no code) | M006 | P0
REQ-072 | Per-agency plugin overrides | M006 | P0
REQ-073 | Self-learning loop (signals -> AI tuner -> suggestions) | M006 | P1
REQ-074 | Algorithm watcher (RSS monitoring of Google Search Central) | M006 | P1
REQ-075 | AIO TL;DR required on all indexable pages (<=120 chars) | M006 | P0
REQ-076 | FAQ schema auto-generated on all FAQ-eligible pages | M006 | P0

==============================================================
AI ASSISTANT
==============================================================
REQ-080 | LiteLLM gateway, single instance, per-agency cost caps | M007 | P0
REQ-081 | 20 AI features in CMS editor | M007 | P0
REQ-082 | Anti-fabrication: stat detector, quote detector, placeholder lint | M007 | P0
REQ-083 | Brand voice + glossary + banned phrases per agency | M007 | P0
REQ-084 | PII redactor before all LiteLLM calls | M007 | P0
REQ-085 | Prompt injection protection (XML wrapping + jailbreak classifier) | M007 | P0
REQ-086 | AI content disclosure when >70% AI-generated | M007 | P0

==============================================================
PUBLIC FRONTEND
==============================================================
REQ-090 | 12 agency Next.js 15 App Router apps | M008 | P0
REQ-091 | ISR + tag-based cache purge (<60s propagation) | M008 | P0
REQ-092 | Art-directed picture element (AVIF -> WebP -> JPEG) | M008 | P0
REQ-093 | BlurHash + dominant color placeholder | M008 | P0
REQ-094 | LCP < 1.8s desktop, < 2.2s mobile (all P0 pages) | M008 | P0
REQ-095 | CLS = 0 (width/height enforced on all images) | M008 | P0
REQ-096 | WCAG 2.2 AA (axe-core CI, zero critical violations) | M008 | P0
REQ-097 | RUM script (web-vitals) on all pages | M008 | P0
REQ-098 | No dangerouslyAllowSVG on Next.js Image component | M008 | P0

==============================================================
CRM + FORMS + BOOKING
==============================================================
REQ-100 | Per-agency CRM (isolated DB, single owner at v1) | M009 | P0
REQ-101 | 9-stage default pipeline + niche overrides pre-seeded | M009 | P0
REQ-102 | Hybrid lead scoring (ICP fit 40%, behavior 35%, recency 15%, source 10%) | M009 | P0
REQ-103 | Pre-seeded: 30 tags, 10 custom fields, 10+ email templates per agency | M009 | P0
REQ-104 | 8 default sequences pre-seeded per agency | M009 | P0
REQ-105 | Email DKIM/SPF/DMARC validation before send-enable | M009 | P0
REQ-106 | TCPA: SMS opt-in required, STOP keyword honored | M009 | P0
REQ-107 | CRM duplicate lead: merge on email match, not create duplicate | M009 | P0
REQ-108 | 4h first-response SLA timer | M009 | P0
REQ-109 | Stripe webhook idempotency (Redis event ID check) | M009 | P0
REQ-110 | Newsletter unsubscribe: stops marketing only, not transactional | M009 | P0
REQ-111 | Sequence enrollment: no double-enrollment (check before enroll) | M009 | P0
REQ-112 | Cal.com self-hosted, white-labeled per agency | M009 | P0
REQ-113 | 6 pre-seeded meeting types per agency | M009 | P0
REQ-114 | Reminders: email 24h + SMS 1h + no-show 5min after start | M009 | P0

==============================================================
TOOLS + PITCH + INVOICING + BUILDER
==============================================================
REQ-120 | 36 tools (3 per agency x 12), all real benchmarks | M010 | P0
REQ-121 | Tool pages: 2200+ words, full SEO/AIO content | M010 | P0
REQ-122 | Tool math: deterministic, no LLM for numbers | M010 | P0
REQ-123 | Tool result: PDF behind email gate -> CRM hook | M010 | P0
REQ-124 | Benchmark data: 12-month expiry enforced, real sources | M010 | P0
REQ-125 | Proposal: hosted page, view tracking, 14-day expiry | M010 | P0
REQ-126 | E-sign: ESIGN Act compliant, PDF storage, audit trail | M010 | P0
REQ-127 | Stripe invoicing: deposit auto-triggered on e-sign | M010 | P0
REQ-128 | Invoice partial payment: tracked in CRM, balance visible | M010 | P0
REQ-129 | Refund: owner-initiated, chargeback evidence auto-compiled | M010 | P0
REQ-130 | Visual page builder: Puck, scoped per agency [spec: specs/builder.md] | M010 | P0
REQ-131 | Admin bar: enable/disable toggle, meta panel, preview, publish [spec: specs/builder.md] | M010 | P0
REQ-132 | Builder auth: server-side session check (not cookie-only) [spec: specs/builder.md] | M010 | P0
REQ-133 | Signed PDF: R2 storage, both parties emailed, client portal | M010 | P0
REQ-134 | Email warm-up: 35 days before sequences activate | M010 | P0

==============================================================
ANALYTICS + COMPLIANCE
==============================================================
REQ-140 | GA4 + GTM server-side container | M011 | P0
REQ-141 | Microsoft Clarity (session replay, heatmaps) | M011 | P0
REQ-142 | Meta CAPI server-side | M011 | P0
REQ-143 | Per-agency analytics dashboards + platform overview | M011 | P0
REQ-144 | CCPA: opt-out, data deletion, export tooling | M011 | P0
REQ-145 | CSP nonce: per-request, injected into inline styles | M011 | P0
REQ-146 | WAF + Cloudflare security rules | M011 | P0
REQ-147 | OWASP ZAP scan: zero high-severity in Phase 12 | M011 | P0

==============================================================
LAUNCH + QA
==============================================================
REQ-150 | Full QA matrix passes for all 12 agencies | M012 | P0
REQ-151 | All P0 pages: real content, real assets, validators pass | M012 | P0
REQ-152 | gsd headless pre-launch gate (exit 0 = pass) | M012 | P0
REQ-153 | Canary deploy: 5% -> health check -> 100% | M012 | P0
REQ-154 | Auto-rollback on regression detection (<60s) | M012 | P0
REQ-155 | 13 runbooks pre-written | M012 | P0
REQ-156 | Brand Setup Wizard: only user task post-generate | M012 | P0
REQ-157 | 14-day post-launch monitoring window | M012 | P0

==============================================================
CONTENT (APPLIES TO ALL MILESTONES)
==============================================================
REQ-200 | Zero placeholder text anywhere | ALL | P0
REQ-201 | Word count floors: blog 1500+, service 1500+, tool 2200+ | M005 | P0
REQ-202 | Alt text required on every image (10+ chars, meaningful) | ALL | P0
REQ-203 | Internal links: 3+ per article | M005 | P0
REQ-204 | Every stat has a real cited source | ALL | P0
REQ-205 | Playbook numbers: ranges only, no exact figures | M005 | P0
REQ-206 | AI content >70%: disclosure metadata required | ALL | P0
REQ-207 | FTC disclaimer on all composite playbook pages | M005 | P0

==============================================================
SECURITY (APPLIES TO ALL MILESTONES)
==============================================================
REQ-300 | jose library ONLY for JWT (no jsonwebtoken) | M003 | P0
REQ-301 | Every server action: session check as first line | ALL | P0
REQ-302 | HMAC signature verification on all webhooks | M009 | P0
REQ-303 | Stripe: raw body (req.text()) for webhook route | M009 | P0
REQ-304 | Stock API keys: server-side proxy only | M001 | P0
REQ-305 | SVG sanitization: DOMPurify + SVGO on every upload | M005 | P0
REQ-306 | BullMQ sensitive payloads: encrypted before Redis | M002 | P0
REQ-307 | Pino logs: redact tokens, emails, phones | M001 | P0
REQ-308 | Open redirect: validate returnTo is same-origin | M003 | P0
REQ-309 | MFA recovery: 8 one-time codes, bcrypt stored | M003 | P0
REQ-310 | JWT claims: iss=mjagency, aud verified on every check | M003 | P0

==============================================================
BUSINESS LOGIC REQUIREMENTS (FROM AUDIT FIXES)
==============================================================
REQ-400 | Agency owner cannot self-delete account | M003 | P0
REQ-401 | Signed PDF stored in R2, emailed to both parties | M010 | P0
REQ-402 | Tool PDF re-sendable via email form on confirmation page | M010 | P0
REQ-403 | Sequence enrollment: no double-enrollment (check before enroll) | M009 | P0
REQ-404 | Email warm-up: 35 days, sequences DRAFT mode until complete | M009 | P0
REQ-405 | Proposal expiry: 14d -> Proposal Expired -> 7d grace -> Nurture | M009 | P0
REQ-406 | Tool benchmarks: yellow warning at expiry, tool stays live | M010 | P0
REQ-407 | Asset permission expiry: auto-pauses asset, fallback shown | M002 | P0
REQ-408 | Subdomain rename: Cal.com redirect configured, old URLs 301 | M003 | P1
REQ-409 | AI content ratio: calculated per field, page-level sum | M007 | P0
REQ-410 | Playbook: composite disclaimer required, exact FTC text | M005 | P0
REQ-411 | Playbook numbers: ranges only, exact figures blocked at publish | M005 | P0
REQ-412 | Case study toggle: is_composite_playbook field, validation on flip | M005 | P0
REQ-413 | Tool result URLs: inline only, NOT separate indexed pages | M010 | P0
REQ-414 | Multi-touch attribution: first + last + all stored, GA4 for math | M009 | P0
REQ-415 | Brand Setup Wizard: logo + color + identity + API keys + DNS + warmup | M012 | P0
REQ-416 | Brand color ΔE check vs pre-seeded imagery (niche guardrails) | M012 | P0
REQ-417 | Newsletter unsubscribe: stops marketing only, not transactional | M009 | P0
REQ-418 | Invoice states: draft->sent->viewed->paid->refunded->disputed | M010 | P0
REQ-419 | Chargeback: evidence auto-compiled (proposal + e-sign + email logs) | M010 | P0
REQ-420 | Chatbot v1: rule-based FSM, lead capture, no LLM | M009 | P1
REQ-421 | FTC 2023: testimonial disclaimer exact text required | M005 | P0
REQ-422 | ESIGN Act: federal coverage for all B2B service contracts | M010 | P0
REQ-423 | TCPA: SMS double opt-in checkbox (unchecked default) | M009 | P0
REQ-424 | Open redirect prevention: returnTo must be same-origin | M003 | P0
REQ-425 | BullMQ sensitive payloads: AES-GCM-256 encrypted before Redis | M002 | P0
REQ-426 | Pino logs: redact tokens, emails, phones, secrets | M001 | P0
REQ-427 | __NEXT_DATA__ audit: CI scan for secret patterns in page props | M001 | P0
REQ-428 | Doppler: one project per agency + shared project | M001 | P0

==============================================================
GSD-2 OPERATIONAL REQUIREMENTS
==============================================================
REQ-500 | Payload pinned: "payload": "3.82.1" exact in all package.json | ALL | P0
REQ-501 | CI check: pnpm list payload | grep 3.82.1 || exit 1 | M001 | P0
REQ-502 | CI check: grep jsonwebtoken (must return 0 results) | M001 | P0
REQ-503 | CI check: grep NEXT_PUBLIC_.*KEY (must return 0 results) | M001 | P0
REQ-504 | gsd headless pre-launch gate: exits 0 before deploy | M012 | P0
REQ-505 | Content sprint workstream: starts after M005 slice 1.2 | M005 | P0
REQ-506 | All milestone files in specs/milestone-M00N.md read before coding | ALL | P0
REQ-507 | Git branch per milestone: squash merge to main on complete | ALL | P0

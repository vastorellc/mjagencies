# Requirements: MJAgency

**Defined:** 2026-04-25
**Core Value:** Every page, every agency, every image slot is 100% real and complete at launch — only the Brand Setup Wizard remains for the user post-generate.

> Source of truth: `mjagency/REQUIREMENTS.md`. IDs preserved (`REQ-NNN`). Priorities P0/P1 from source.

## v1 Requirements

### Infrastructure (Phase 1)

- [ ] **REQ-001**: Turborepo monorepo with 12 agency apps + shared packages — P0
- [ ] **REQ-002**: Docker Compose for local dev (13 Postgres, Redis, Mailhog) — P0
- [ ] **REQ-003**: Cloudflare Images + Stream + R2 + Workers + WAF — P0
- [ ] **REQ-004**: OpenTelemetry traces across all services — P1
- [ ] **REQ-005**: GitHub Actions CI/CD with canary gate — P0
- [ ] **REQ-006**: VPS — 8GB RAM minimum, 4GB swap — P0
- [ ] **REQ-007**: PM2 cluster mode per agency app — P0
- [ ] **REQ-304**: Stock API keys — server-side proxy only — P0
- [ ] **REQ-307**: Pino logs — redact tokens, emails, phones — P0
- [ ] **REQ-426**: Pino logs — redact tokens, emails, phones, secrets — P0
- [ ] **REQ-427**: `__NEXT_DATA__` audit — CI scan for secret patterns in page props — P0
- [ ] **REQ-428**: Doppler — one project per agency + shared project — P0
- [ ] **REQ-501**: CI check — `pnpm list payload | grep 3.82.1 || exit 1` — P0
- [ ] **REQ-502**: CI check — `grep jsonwebtoken` (must return 0 results) — P0
- [ ] **REQ-503**: CI check — `grep NEXT_PUBLIC_.*KEY` (must return 0 results) — P0

### Database (Phase 2)

- [ ] **REQ-010**: Per-agency PostgreSQL 17 database (13 total) — P0
- [ ] **REQ-011**: PgBouncer per agency, transaction mode, pool_size=20 — P0
- [ ] **REQ-012**: Drizzle ORM with strict TypeScript types — P0
- [ ] **REQ-013**: Row-level security on all agency-scoped tables — P0
- [ ] **REQ-014**: `agency_id` immutable after creation — P0
- [ ] **REQ-015**: Migration runner — parallel, dry-run, canary, rollback — P0
- [ ] **REQ-016**: Seed scripts — transactional, resume on fail — P0
- [ ] **REQ-017**: Backup — hourly WAL + snapshots, R2 upload, quarterly DR — P0
- [ ] **REQ-018**: Permissions vault (encrypted, 7yr retention) — P0
- [ ] **REQ-019**: Audit log — hash-chained, append-only — P0
- [ ] **REQ-306**: BullMQ sensitive payloads encrypted before Redis — P0
- [ ] **REQ-407**: Asset permission expiry — auto-pauses asset, fallback shown — P0
- [ ] **REQ-425**: BullMQ sensitive payloads — AES-GCM-256 encrypted before Redis — P0

### Authentication (Phase 3)

- [ ] **REQ-020**: JWT using `jose` library ONLY (never `jsonwebtoken`) — P0
- [ ] **REQ-021**: Access token — 15min TTL, iss=mjagency, aud=mjagency-api — P0
- [ ] **REQ-022**: Refresh token — 7d TTL, one-time use, family revocation — P0
- [ ] **REQ-023**: Tokens in httpOnly + SameSite=Strict + Secure cookies — P0
- [ ] **REQ-024**: MFA mandatory for super_admin + admin roles — P0
- [ ] **REQ-025**: TOTP + 8 one-time recovery codes — P0
- [ ] **REQ-026**: SSO at accounts.brand.com — P1
- [ ] **REQ-027**: Session regeneration on privilege escalation — P0
- [ ] **REQ-028**: Agency owner cannot self-delete account — P0
- [ ] **REQ-029**: Next.js version >= 15.2.3 (CVE-2025-29927 patch) — P0
- [ ] **REQ-030**: Cloudflare middleware excludes `/admin` and `/api` routes — P0
- [ ] **REQ-031**: Every server action — auth check as first line — P0
- [ ] **REQ-300**: `jose` library ONLY for JWT (no `jsonwebtoken`) — P0
- [ ] **REQ-308**: Open redirect — validate `returnTo` is same-origin — P0
- [ ] **REQ-309**: MFA recovery — 8 one-time codes, bcrypt stored — P0
- [ ] **REQ-310**: JWT claims — iss=mjagency, aud verified on every check — P0
- [ ] **REQ-400**: Agency owner cannot self-delete account — P0
- [ ] **REQ-408**: Subdomain rename — Cal.com redirect configured, old URLs 301 — P1
- [ ] **REQ-424**: Open redirect prevention — `returnTo` must be same-origin — P0

### Design System (Phase 4)

- [ ] **REQ-040**: CSS variable token schema (6 layers) — P0
- [ ] **REQ-041**: `theme.json` manifest + JSON Schema validator — P0
- [ ] **REQ-042**: 20 customization scopes per agency — P0
- [ ] **REQ-043**: Theme resolution — base → agency → page — P0
- [ ] **REQ-044**: 12 niche default themes pre-built — P0
- [ ] **REQ-045**: Theme switch < 16ms (CSS variable update) — P0
- [ ] **REQ-046**: Dark mode via token swap, no asset reload — P0
- [ ] **REQ-047**: SVG illustrations — token vars, no hex literals — P0
- [ ] **REQ-048**: Storybook — one story per block (45 blocks), all 12 niche themes, visual regression CI — P1

### CMS (Phase 5)

- [ ] **REQ-050**: Payload CMS 3.82.1 EXACTLY (pinned) — P0
- [ ] **REQ-051**: Embedded model — Payload inside Next.js via `withPayload()` — P0
- [ ] **REQ-052**: 45 blocks across 11 categories — P0
- [ ] **REQ-053**: Lexical editor — full toolbar (H1-H6, bold, color, link, table, etc.) — P0
- [ ] **REQ-054**: Lexical — fixed toolbar + inline toolbar both enabled — P0
- [ ] **REQ-055**: SEO/AIO/GEO panel in CMS editor sidebar (real-time scoring) — P0
- [ ] **REQ-056**: Draft → review → publish workflow — P0
- [ ] **REQ-057**: Scheduled publishing via BullMQ — P0
- [ ] **REQ-058**: 20 rolling revisions per content item — P0
- [ ] **REQ-059**: Global blocks (edit once, propagate everywhere) — P0
- [ ] **REQ-060**: DAM — 3 views (super_admin, admin, editor picker) — P0
- [ ] **REQ-061**: DAM — text + semantic + visual + color search — P0
- [ ] **REQ-062**: Brand portal (external partner access, signed links) — P1
- [ ] **REQ-063**: Living brand book per agency (auto-rendered from tokens) — P1
- [ ] **REQ-201**: Word count floors — blog 1500+, service 1500+, tool 2200+ — P0
- [ ] **REQ-203**: Internal links — 3+ per article — P0
- [ ] **REQ-205**: Playbook numbers — ranges only, no exact figures — P0
- [ ] **REQ-207**: FTC disclaimer on all composite playbook pages — P0
- [ ] **REQ-305**: SVG sanitization — DOMPurify + SVGO on every upload — P0
- [ ] **REQ-410**: Playbook — composite disclaimer required, exact FTC text — P0
- [ ] **REQ-411**: Playbook numbers — ranges only, exact figures blocked at publish — P0
- [ ] **REQ-412**: Case study toggle — `is_composite_playbook` field, validation on flip — P0
- [ ] **REQ-421**: FTC 2023 — testimonial disclaimer exact text required — P0
- [ ] **REQ-505**: Content sprint workstream — starts after M005 slice 1.2 — P0

### SEO / AIO / GEO (Phase 6)

- [x] **REQ-070**: 3 SEO plugins — seo-classic, aio-citations, geo-chunking — P0
- [x] **REQ-071
**: Plugin runtime — all weights/rules editable in admin (no code) — P0
- [x] **REQ-072
**: Per-agency plugin overrides — P0
- [x] **REQ-073
**: Self-learning loop (signals → AI tuner → suggestions) — P1
- [x] **REQ-074**: Algorithm watcher (RSS monitoring of Google Search Central) — P1
- [x] **REQ-075
**: AIO TL;DR required on all indexable pages (≤120 chars) — P0
- [x] **REQ-076**: FAQ schema auto-generated on all FAQ-eligible pages — P0

### AI Assistant (Phase 7)

- [ ] **REQ-080**: LiteLLM gateway — single instance, per-agency cost caps — P0
- [ ] **REQ-081**: 20 AI features in CMS editor — P0
- [ ] **REQ-082**: Anti-fabrication — stat detector, quote detector, placeholder lint — P0
- [ ] **REQ-083**: Brand voice + glossary + banned phrases per agency — P0
- [ ] **REQ-084**: PII redactor before all LiteLLM calls — P0
- [ ] **REQ-085**: Prompt injection protection (XML wrapping + jailbreak classifier) — P0
- [ ] **REQ-086**: AI content disclosure when >70% AI-generated — P0
- [ ] **REQ-409**: AI content ratio — calculated per field, page-level sum — P0

### Public Frontend (Phase 8)

- [ ] **REQ-090**: 12 agency Next.js 15 App Router apps — P0
- [ ] **REQ-091**: ISR + tag-based cache purge (<60s propagation) — P0
- [ ] **REQ-092**: Art-directed picture element (AVIF → WebP → JPEG) — P0
- [ ] **REQ-093**: BlurHash + dominant color placeholder — P0
- [ ] **REQ-094**: LCP < 1.8s desktop, < 2.2s mobile (all P0 pages) — P0
- [ ] **REQ-095**: CLS = 0 (width/height enforced on all images) — P0
- [ ] **REQ-096**: WCAG 2.2 AA (axe-core CI, zero critical violations) — P0
- [ ] **REQ-097**: RUM script (web-vitals) on all pages — P0
- [ ] **REQ-098**: No `dangerouslyAllowSVG` on Next.js Image component — P0

### CRM + Forms + Booking (Phase 9)

- [ ] **REQ-100**: Per-agency CRM (isolated DB, single owner at v1) — P0
- [ ] **REQ-101**: 9-stage default pipeline + niche overrides pre-seeded — P0
- [ ] **REQ-102**: Hybrid lead scoring (ICP fit 40%, behavior 35%, recency 15%, source 10%) — P0
- [ ] **REQ-103**: Pre-seeded — 30 tags, 10 custom fields, 10+ email templates per agency — P0
- [ ] **REQ-104**: 8 default sequences pre-seeded per agency — P0
- [ ] **REQ-105**: Email DKIM/SPF/DMARC validation before send-enable — P0
- [ ] **REQ-106**: TCPA — SMS opt-in required, STOP keyword honored — P0
- [ ] **REQ-107**: CRM duplicate lead — merge on email match, not create duplicate — P0
- [ ] **REQ-108**: 4h first-response SLA timer — P0
- [ ] **REQ-109**: Stripe webhook idempotency (Redis event ID check) — P0
- [ ] **REQ-110**: Newsletter unsubscribe — stops marketing only, not transactional — P0
- [ ] **REQ-111**: Sequence enrollment — no double-enrollment (check before enroll) — P0
- [ ] **REQ-112**: Cal.com self-hosted, white-labeled per agency — P0
- [ ] **REQ-113**: 6 pre-seeded meeting types per agency — P0
- [ ] **REQ-114**: Reminders — email 24h + SMS 1h + no-show 5min after start — P0
- [ ] **REQ-302**: HMAC signature verification on all webhooks — P0
- [ ] **REQ-303**: Stripe — raw body (`req.text()`) for webhook route — P0
- [ ] **REQ-403**: Sequence enrollment — no double-enrollment (check before enroll) — P0
- [ ] **REQ-404**: Email warm-up — 35 days, sequences DRAFT mode until complete — P0
- [ ] **REQ-405**: Proposal expiry — 14d → Proposal Expired → 7d grace → Nurture — P0
- [ ] **REQ-414**: Multi-touch attribution — first + last + all stored, GA4 for math — P0
- [ ] **REQ-417**: Newsletter unsubscribe — stops marketing only, not transactional — P0
- [ ] **REQ-420**: Chatbot v1 — rule-based FSM, lead capture, no LLM — P1
- [ ] **REQ-423**: TCPA — SMS double opt-in checkbox (unchecked default) — P0

### Tools + Pitch + Invoicing + Builder (Phase 10)

- [ ] **REQ-120**: 36 tools (3 per agency × 12), all real benchmarks — P0
- [ ] **REQ-121**: Tool pages — 2200+ words, full SEO/AIO content — P0
- [ ] **REQ-122**: Tool math — deterministic, no LLM for numbers — P0
- [ ] **REQ-123**: Tool result — PDF behind email gate → CRM hook — P0
- [ ] **REQ-124**: Benchmark data — 12-month expiry enforced, real sources — P0
- [ ] **REQ-125**: Proposal — hosted page, view tracking, 14-day expiry — P0
- [ ] **REQ-126**: E-sign — ESIGN Act compliant, PDF storage, audit trail — P0
- [ ] **REQ-127**: Stripe invoicing — deposit auto-triggered on e-sign — P0
- [ ] **REQ-128**: Invoice partial payment — tracked in CRM, balance visible — P0
- [ ] **REQ-129**: Refund — owner-initiated, chargeback evidence auto-compiled — P0
- [ ] **REQ-130**: Visual page builder — Puck, scoped per agency [spec: specs/builder.md] — P0
- [ ] **REQ-131**: Admin bar — enable/disable toggle, meta panel, preview, publish [spec: specs/builder.md] — P0
- [ ] **REQ-132**: Builder auth — server-side session check (not cookie-only) [spec: specs/builder.md] — P0
- [ ] **REQ-133**: Signed PDF — R2 storage, both parties emailed, client portal — P0
- [ ] **REQ-134**: Email warm-up — 35 days before sequences activate — P0
- [ ] **REQ-401**: Signed PDF stored in R2, emailed to both parties — P0
- [ ] **REQ-402**: Tool PDF re-sendable via email form on confirmation page — P0
- [ ] **REQ-406**: Tool benchmarks — yellow warning at expiry, tool stays live — P0
- [ ] **REQ-413**: Tool result URLs — inline only, NOT separate indexed pages — P0
- [ ] **REQ-418**: Invoice states — draft→sent→viewed→paid→refunded→disputed — P0
- [ ] **REQ-419**: Chargeback — evidence auto-compiled (proposal + e-sign + email logs) — P0
- [ ] **REQ-422**: ESIGN Act — federal coverage for all B2B service contracts — P0

### Analytics + Compliance + Security (Phase 11)

- [x] **REQ-140**: GA4 + GTM server-side container — P0
- [ ] **REQ-141**: Microsoft Clarity (session replay, heatmaps) — P0
- [x] **REQ-142
**: Meta CAPI server-side — P0
- [ ] **REQ-143**: Per-agency analytics dashboards + platform overview — P0
- [ ] **REQ-144**: CCPA — opt-out, data deletion, export tooling — P0
- [ ] **REQ-145**: CSP nonce — per-request, injected into inline styles — P0
- [x] **REQ-146
**: WAF + Cloudflare security rules — P0
- [ ] **REQ-147**: OWASP ZAP scan — zero high-severity in Phase 12 — P0

### Launch + QA (Phase 12)

- [ ] **REQ-150**: Full QA matrix passes for all 12 agencies — P0
- [ ] **REQ-151**: All P0 pages — real content, real assets, validators pass — P0
- [ ] **REQ-152**: `gsd headless` pre-launch gate (exit 0 = pass) — P0
- [ ] **REQ-153**: Canary deploy — 5% → health check → 100% — P0
- [ ] **REQ-154**: Auto-rollback on regression detection (<60s) — P0
- [ ] **REQ-155**: 13 runbooks pre-written — P0
- [ ] **REQ-156**: Brand Setup Wizard — only user task post-generate — P0
- [ ] **REQ-157**: 14-day post-launch monitoring window — P0
- [ ] **REQ-415**: Brand Setup Wizard — logo + color + identity + API keys + DNS + warmup — P0
- [ ] **REQ-416**: Brand color ΔE check vs pre-seeded imagery (niche guardrails) — P0
- [ ] **REQ-504**: `gsd headless` pre-launch gate — exits 0 before deploy — P0

### Cross-Cutting (applies to all milestones)

- [ ] **REQ-200**: Zero placeholder text anywhere — P0
- [ ] **REQ-202**: Alt text on every image (10+ chars, meaningful) — P0
- [ ] **REQ-204**: Every stat has a real cited source — P0
- [ ] **REQ-206**: AI content >70% — disclosure metadata required — P0
- [ ] **REQ-301**: Every server action — session check as first line — P0
- [ ] **REQ-500**: Payload pinned — `"payload": "3.82.1"` exact in all `package.json` — P0
- [ ] **REQ-506**: All milestone files in `specs/milestone-M00N.md` read before coding — P0
- [ ] **REQ-507**: Git branch per milestone — squash merge to main on complete — P0

## v2 Requirements

### Real-Time Collaboration

- **YJS-01**: Multi-user concurrent editing in builder/CMS (Yjs CRDT) — deferred from v1

### International Expansion

- **INTL-01**: Non-US regions, multi-currency, GDPR — deferred (US-only at v1)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Yjs real-time collaboration | Single-user builder sufficient for v1; CRDT adds complexity to RLS/auth boundary |
| International / multi-region | US-only at v1; tax + compliance + currency overhead deferred |
| Mobile-native apps | Web-first; mobile after v1 launch validates demand |
| Payload upgrades past 3.82.1 | Pinned version; multi-tenant CMS surface is wide and breakage cost is high |
| `jsonwebtoken` library | Edge runtime incompatible; would break middleware |
| User authoring content post-generate | Inverts the product promise (Content-Complete Rule); only Brand Setup Wizard is user-facing |
| Cloudflare middleware over Payload admin / API | Explicitly excluded from matcher; Payload routes need Node runtime |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-001…REQ-007, REQ-304, REQ-307, REQ-426, REQ-427, REQ-428, REQ-501, REQ-502, REQ-503 | Phase 1 | Pending |
| REQ-010…REQ-019, REQ-306, REQ-407, REQ-425 | Phase 2 | Pending |
| REQ-020…REQ-031, REQ-300, REQ-308, REQ-309, REQ-310, REQ-400, REQ-408, REQ-424 | Phase 3 | Pending |
| REQ-040…REQ-048 | Phase 4 | Pending |
| REQ-050…REQ-063, REQ-201, REQ-203, REQ-205, REQ-207, REQ-305, REQ-410, REQ-411, REQ-412, REQ-421, REQ-505 | Phase 5 | Pending |
| REQ-070…REQ-076 | Phase 6 | REQ-070, REQ-071, REQ-072, REQ-075, REQ-076 complete (plans 06-01 through 06-03) |
| REQ-080…REQ-086, REQ-409 | Phase 7 | Pending |
| REQ-090…REQ-098 | Phase 8 | Pending |
| REQ-100…REQ-114, REQ-302, REQ-303, REQ-403, REQ-404, REQ-405, REQ-414, REQ-417, REQ-420, REQ-423 | Phase 9 | Pending |
| REQ-120…REQ-134, REQ-401, REQ-402, REQ-406, REQ-413, REQ-418, REQ-419, REQ-422 | Phase 10 | Pending |
| REQ-140…REQ-147 | Phase 11 | Pending |
| REQ-150…REQ-157, REQ-415, REQ-416, REQ-504 | Phase 12 | Pending |
| REQ-200, REQ-202, REQ-204, REQ-206, REQ-301, REQ-500, REQ-506, REQ-507 | All phases | Pending |

**Coverage:**
- v1 requirements: 205 total
- Mapped to phases: 205
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-25 (imported from `mjagency/REQUIREMENTS.md`)*
*Last updated: 2026-04-25 after `.planning/` bootstrap*

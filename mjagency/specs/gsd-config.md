specs/gsd-config.md - GSD-2 Configuration Spec

==============================================================
GSD-2 SETUP
==============================================================
Version: latest (gsd-2, not gsd v1)
Install: npm install -g gsd-2 (or per gsd-2 docs)
Run: gsd (in monorepo root)

First run sequence:
  1. gsd (starts interactive TUI)
  2. Select LLM provider: Anthropic
  3. Configure model profiles (see below)
  4. gsd new-milestone -> M001 Foundation

==============================================================
MODEL PROFILE CONFIGURATION
==============================================================
In GSD-2 settings:

Planning profile (discuss + plan phases):
  Provider: Anthropic
  Model: claude-opus-4-6
  Use for: Architecture decisions, design tradeoffs

Architecture milestones (M001, M002, M003):
  Provider: Anthropic
  Model: claude-opus-4-6

Execution milestones (M004-M012):
  Provider: Anthropic
  Model: claude-sonnet-4-6

Research tasks:
  Provider: Google
  Model: gemini-2.5-flash-lite
  (or inherit from session for simplicity)

Content tasks:
  Provider: Google
  Model: gemini-2.5-flash-lite

Cost: UNLIMITED (owner confirmed, do not add budget limits)

==============================================================
GIT ISOLATION STRATEGY
==============================================================
Mode: branch (not worktree, not none)

Each milestone runs on:
  branch: milestone/M001-foundation-infra
  branch: milestone/M002-multitenant-db
  etc.

Slice work commits sequentially on that branch.
On milestone complete: squash merge to main (one clean commit per milestone).
PR review: optional between milestones.

No branch switching during milestone execution.
GSD-2 handles all git operations automatically.

==============================================================
CLAUDE.md LOCATION
==============================================================
Root of monorepo: /CLAUDE.md
GSD-2 reads this automatically on every agent spawn.
Do NOT split into multiple CLAUDE.md files.
All critical rules in single CLAUDE.md.

==============================================================
PROJECT.md LOCATION
==============================================================
Root of monorepo: /PROJECT.md
Injected into every task context via GSD-2 Context Mode.
Kept to <3000 words (token budget management).
Detailed specs live in /specs/*.md (injected per task).

==============================================================
SPECS INJECTION STRATEGY
==============================================================
GSD-2 Context Mode auto-injects relevant specs per task.
Tag each spec file with keywords GSD-2 can match:

specs/architecture.md  -> tags: database, auth, jwt, redis, api, cloudflare
specs/security.md      -> tags: security, auth, webhook, csp, xss
specs/cms.md           -> tags: payload, cms, blocks, lexical, puck, builder
specs/crm.md           -> tags: crm, forms, booking, cal.com, stripe, invoice
specs/media.md         -> tags: images, avif, cloudflare, illustrations, icons
specs/content.md       -> tags: content, seo, blog, tools, copy, placeholder
specs/tools.md         -> tags: tools, calculator, benchmark
specs/analytics.md     -> tags: analytics, ga4, rum, compliance

Milestone specs injected at milestone start:
  specs/milestone-M001.txt through specs/milestone-M012.txt

==============================================================
CONTENT SPRINT WORKSTREAM
==============================================================
Create as separate GSD-2 workstream named: content

Start: after M005 cms-collections slice completes
End: before M012 pre-launch gate

Workstream purpose:
  Draft all content via LiteLLM (Flash-Lite)
  Write to Payload CMS via REST API
  Run validators on every save
  Cover all 12 agencies x all content types

Content sprint does NOT block engineering milestones.
Engineering and content run in parallel.
Both write to same Payload CMS instance.

==============================================================
PRE-LAUNCH CI GATE (M012)
==============================================================
Headless mode command:
  gsd headless --timeout 3600000 next

Exit codes:
  0 = all checks pass -> promote canary to 100%
  1 = checks failed -> block deploy, log error, Slack alert
  2 = blocked (needs human decision) -> Slack alert

Gate checks (all must pass):
  - All 12 agencies: P0 pages exist
  - All P0 pages: word count above floor
  - All real-only slots: real photos (no AI/stock)
  - All image slots: filled (no missing)
  - All validators: green
  - All schemas: valid (Google Rich Results test)
  - All tool pages: benchmark data loaded
  - All CRM: pre-seeded data present
  - All sequences: real copy (no placeholder)
  - Playwright e2e: critical paths pass
  - Lighthouse CI: LCP <2.5s, CLS <0.1 on all P0 pages
  - axe-core: zero critical violations
  - OWASP ZAP: zero high-severity findings
  - Stripe webhook: idempotency test passes
  - RLS: cross-agency isolation test passes
  - Payload version: exactly 3.82.1
  - CVE-2025-29927: Next.js version check (>=15.2.3)

==============================================================
CRASH RECOVERY
==============================================================
GSD-2 handles crash recovery automatically.
Lock file tracks current task.
If session dies: next gsd auto reads surviving session files.
Synthesizes recovery briefing from disk state.
Resumes with full context.

No manual intervention needed for crashes.
Just run: gsd auto (resumes from last known state)

==============================================================
MILESTONE COMPLETION CHECKLIST
==============================================================
After each milestone gsd auto completes:

1. Review slice summary in GSD-2 dashboard
2. Run: gsd headless query (verify state is clean)
3. Check git log: squash merge to main looks correct
4. Run CI: pnpm test (all tests pass)
5. Verify: no Payload version drift (pnpm list payload)
6. Verify: no jsonwebtoken in codebase (grep check)
7. Next: gsd new-milestone (start next in sequence)

Do NOT start next milestone until current is fully merged.

==============================================================
CONTENT SPRINT WORKSTREAM — DETAILED CONFIG
==============================================================
GSD-2 workstream name: "content"
Workstream type: parallel (runs alongside engineering workstream)

Start trigger:
  M005 SLICE 1, TASK 1.2 (cms-collections) complete
  GSD-2 dependency: content workstream blocked until
    apps/web-main/payload.config.ts exists AND
    All core collections exist in Payload admin

Content workstream task list (auto-generated at start):
  For each of 12 agencies:
    Task: draft-agency-<slug>-blog-posts
      Model: gemini-2.5-flash-lite
      Input: agency niche + brand voice + SEO keywords
      Output: 3 cornerstone blog posts (1500-3000 words each)
      Write to: POST /api/payload/posts (Payload REST API)

    Task: draft-agency-<slug>-service-pages
      Model: gemini-2.5-flash-lite
      Input: agency niche + service catalog + ICP
      Output: services hub + 3-5 service detail pages
      Write to: POST /api/payload/pages

    Task: draft-agency-<slug>-supporting-pages
      Model: gemini-2.5-flash-lite
      Output: about, contact, FAQ, legal pages
      Write to: POST /api/payload/pages

    Task: draft-agency-<slug>-tool-content
      Model: gemini-2.5-flash-lite
      Output: 3 tool pages (2200+ words each)
      Write to: POST /api/payload/tools

    Task: seed-agency-<slug>-crm-templates
      Model: gemini-2.5-flash-lite
      Output: 10 email templates, 8 sequences (AI-drafted per niche)
      Write to: POST /api/payload/crm-templates

    Task: validate-agency-<slug>-content
      Model: claude-sonnet-4-6 (critical check)
      Action: run all validators on seeded content
      Fails: if any word count below floor, any placeholder found, any missing alt

Total content tasks: 12 agencies × 6 tasks = 72 tasks in content workstream

Content sprint completion: when all 72 tasks pass validation
Content sprint is a DEPENDENCY of M012 launch gate.

==============================================================
IRON RULE COMPLIANCE NOTES
==============================================================
Iron Rule: each GSD-2 task must fit in one context window.

Known large task risks (need task-level splitting):
  "Build all 45 blocks" -> split into 7 subtasks by block category
  "Build all 36 tools" -> split into 12 subtasks (3 tools per batch)
  "Seed all 12 agencies" -> split into 12 tasks (1 agency per task)
  "Write all runbooks" -> split into 13 tasks (1 runbook per task)
  "Drizzle schema all tables" -> split into 3 batches (schema groups)

GSD-2 will further split tasks at runtime if task scope is too large.
If agent reports context overflow, split immediately (do not retry as-is).

==============================================================
WHAT GSD-2 READS ON SESSION START
==============================================================
Auto-injected by GSD-2 on every session:
  1. PROJECT.md (summary context)
  2. CLAUDE.md (agent rules)
  3. AGENTS.md (routing config)

Injected at milestone start:
  4. specs/milestone-M00N.txt (current milestone)
  5. Relevant specs/ files (based on milestone tags)

Injected on demand (when agent requests):
  6. Any specs/ file the agent needs
  7. Codebase files (via scout agent)

NOT auto-injected (too large):
  REQUIREMENTS.md (reference only, agent searches if needed)
  ROADMAP.md (agent reads milestone section only)
  Full crm.md or cms.md (agent reads sections relevant to slice)

AGENTS.md - MJAgency GSD-2 Agent Routing

==============================================================
AGENT TYPES AND ROUTING
==============================================================

GSD-2 uses three built-in agent types:
  scout      - Reads codebase, discovers patterns, maps files
  researcher - Reads docs, specs, external references
  worker     - Writes code, generates files, executes tasks

==============================================================
MODEL ASSIGNMENTS PER TASK TYPE
==============================================================

Planning tasks (discuss-phase, plan-phase):
  Model: claude-opus-4-6
  Use for: Architecture decisions, design questions, tradeoff analysis

Architecture milestones (M001, M002, M003):
  Model: claude-opus-4-6
  Reason: Foundational decisions have high blast radius if wrong

Execution milestones (M004-M012):
  Model: claude-sonnet-4-6
  Reason: Code generation, component building, integration work

Research tasks (reading docs, specs, libraries):
  Model: gemini-2.5-flash-lite
  Reason: Fast, cheap, good at reading and summarizing

Content drafting tasks (blog posts, copy, FAQ, tool content):
  Model: gemini-2.5-flash-lite
  Reason: Volume drafting does not require expensive model

Verification tasks (review output, check correctness):
  Model: claude-sonnet-4-6
  Reason: Critical to catch mistakes before commit

==============================================================
CUSTOM AGENT BEHAVIORS
==============================================================

Before any task involving Payload CMS:
  Read: specs/cms.md (relevant sections only)
  Check: Payload version is 3.82.1 in package.json
  Verify: withPayload() wrapper present in next.config.mjs

Before any task involving auth:
  Read: specs/architecture.md (auth section)
  Check: jose library imported, not jsonwebtoken
  Verify: JWT issuer + audience set

Before any task involving database:
  Read: specs/architecture.md (database section)
  Check: Every query has .where(eq(table.agencyId, ctx.agencyId))
  Verify: RLS migration present for new tables

Before any task involving media/images:
  Read: specs/media.md
  Check: No dangerouslyAllowSVG on Next.js Image
  Check: SVG sanitization runs on all SVG uploads

Before any task involving the visual page builder (Puck):
  Read: specs/builder.md (System A section)
  Check: Server action has auth + agency_id check as first two lines
  Check: Puck outputs JSON, never dangerouslySetInnerHTML
  Check: Cookie is UI toggle only, auth is server-side

Before any task involving the CMS post editor (Lexical):
  Read: specs/builder.md (System B section)
  Check: All toolbar features configured via Feature imports
  Check: DOMPurify sanitizes HTML output before render
  Check: SEO/AIO/GEO panel wired to packages/seo scoring engine

Before any task involving API endpoints or server actions:
  Read: specs/security.md
  Check: Auth check at top of every handler
  Check: No secrets in response payloads or logs

Before any task involving content generation:
  Read: specs/content.md
  Check: No placeholder text anywhere
  Check: Word count floors met for page type
  Check: Real benchmark sources cited

Before any task involving webhooks:
  Read: specs/security.md (webhook section)
  Check: HMAC signature verification before processing
  Check: Idempotency check via Redis event ID
  Check: Stripe uses req.text() for raw body

==============================================================
SCOUT AGENT INSTRUCTIONS
==============================================================
When mapping codebase for a new slice:
1. Read packages/db/schema.ts for existing table definitions
2. Read packages/auth/index.ts for session type
3. Read turbo.json for pipeline dependencies
4. Report back: what exists, what gaps, what risks

When scouting for milestone M005 (CMS):
1. Confirm Payload 3.82.1 in package.json
2. Confirm withPayload in next.config.mjs
3. Check apps/web-main/payload.config.ts exists
4. Map existing collections

==============================================================
RESEARCHER AGENT INSTRUCTIONS
==============================================================
Primary reference files (inject when relevant):
  Project context:  PROJECT.md
  Agent rules:      CLAUDE.md
  Architecture:     specs/architecture.md
  Security:         specs/security.md
  Current milestone: specs/milestone-M00N.md

External documentation allowed:
  Payload CMS 3.x docs: https://payloadcms.com/docs
  Next.js 15 docs: https://nextjs.org/docs
  Drizzle ORM docs: https://orm.drizzle.team/docs
  jose docs: https://github.com/panva/jose
  Puck docs: https://puckeditor.com/docs
  BullMQ docs: https://docs.bullmq.io

==============================================================
WORKER AGENT INSTRUCTIONS
==============================================================
Code quality non-negotiables:
  - TypeScript strict mode, no any
  - Vitest tests for all business logic
  - Pino logger with redact config on all services
  - Error messages: generic to client, detailed to logs
  - Commits: atomic per task, descriptive message

Commit message format:
  feat(M00N-slice): brief description of what was built
  fix(M00N-slice): brief description of what was fixed
  test(M00N-slice): tests added for X

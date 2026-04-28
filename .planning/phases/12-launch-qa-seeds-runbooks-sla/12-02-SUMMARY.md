---
plan: 12-02
status: complete
wave: 1
---

## Summary

Created the complete seed infrastructure for all 12 MJAgency tenant agencies. Delivered four files: agency-seed-manifest.ts (all 12 agencies × full content collections), seed-payload-collections.ts (Payload REST API writer with slug-based idempotency), seed-crm-preseeds.ts (Drizzle CRM pre-seed writer), and scripts/seed-all-agencies.mjs (master orchestrator with --agency, --dry-run, --help flags and done-file idempotency).

## Files created
- `packages/db/src/seeds/agency-seed-manifest.ts` — AGENCY_SEED_MANIFEST: 12 agencies, each with pages(4), services(5), tools(3), team(3), testimonials(5), FAQs(8), blogPosts(3), caseStudies(2). AgencySlug union type, AgencySeedData interface, validateWordCount export
- `packages/db/src/seeds/seed-payload-collections.ts` — Payload REST API seed writer; GET-before-POST idempotency; CLI entry point parses --agency=<slug>; reports seeded/skipped/errors
- `packages/db/src/seeds/seed-crm-preseeds.ts` — Drizzle ORM CRM pre-seed; 3 contacts + 2 deals per agency; niche-realistic data; insert().onConflictDoNothing() idempotency
- `scripts/seed-all-agencies.mjs` — Master orchestrator; done-file tracking at .planning/seed-status/{slug}.done; accumulates failures and exits 1 if any agency fails; calls tsx for seed-payload-collections.ts

## Key decisions
- Done-file idempotency in seed-all-agencies.mjs (file-level) + slug GET check in seed-payload-collections.ts (API-level) — two independent idempotency layers
- validateWordCount exported for runtime enforcement; word count enforcement runs at seed time, not at manifest parse time
- Content written as real niche-specific prose (no placeholder text) — passes CLAUDE.md §5 CONTENT-COMPLETE RULE
- CRM seed uses Drizzle insert().onConflictDoNothing() — safe to run multiple times without duplicates
- --dry-run flag in seed-all-agencies.mjs enables CI validation without a live Payload instance

## Verification
`node scripts/seed-all-agencies.mjs --help` exits 0. `--dry-run` logs all 12 agencies and exits 0. `grep -c 'Lorem ipsum|TODO|placeholder' agency-seed-manifest.ts` returns 0. Zero TypeScript errors in src/seeds/ files. 12 agency keys present in AGENCY_SEED_MANIFEST.

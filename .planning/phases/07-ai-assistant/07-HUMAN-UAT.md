---
status: partial
phase: 07-ai-assistant
source: [07-VERIFICATION.md]
started: 2026-04-27T05:00:00Z
updated: 2026-04-27T05:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. AI editor toolbar end-to-end in Lexical editor
expected: Open a page in Payload admin, click the AiPanel toolbar. Select text and use "Rewrite" and "Shorten" actions — content should update. Use "Draft from Title" on an empty page — content should be generated. Budget-exceeded error should surface as a dismissible banner, not a crash.
result: [pending]

### 2. Payload migrate with live Postgres (brand_voice + brand_glossary tables)
expected: Running `CI=true PAYLOAD_MIGRATING=true DATABASE_URL=<live-db> npx payload migrate` from `apps/web-main/` creates the `brand_voice` and `brand_glossary` tables. Admin sidebar shows "Brand Voice" and "Brand Glossary" under the "Branding" group for agency admins.
result: [pending]

### 3. Brand Voice rewrite end-to-end
expected: Create a brand_voice record for an agency. Use the "Brand Voice Rewrite" AI action on a paragraph — the rewrite should reflect the configured tone/style/glossary terms. No error if brand voice is not configured (graceful fallback to generic rewrite).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

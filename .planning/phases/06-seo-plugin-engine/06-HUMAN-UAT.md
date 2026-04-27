---
status: partial
phase: 06-seo-plugin-engine
source: [06-VERIFICATION.md]
started: 2026-04-27T02:40:00Z
updated: 2026-04-27T02:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SeoPanel live score display
expected: Three score bars (SEO Classic, AIO Citations, Geo Chunking) and the aggregate score display update after 500ms debounce when typing in the Lexical editor. Scores reflect actual content changes.
result: [pending]

### 2. TL;DR Regenerate button
expected: Auto-generation triggers once on first open when aio_tldr is empty. Regenerate button shows 'Generating...' state and then populates the field with a new AI-generated summary (≤120 chars).
result: [pending]

### 3. algo_alerts / seo_suggestions superAdminOnly
expected: Neither seo_suggestions nor algo_alerts appears in the admin sidebar for agency admin users — only super_admin can see them.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

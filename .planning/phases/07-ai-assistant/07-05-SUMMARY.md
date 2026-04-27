---
phase: 07-ai-assistant
plan: "05"
subsystem: ai-pii-redactor
tags: [pii, redaction, security, litellm, generate-content, tdd, vitest, req-084]
dependency_graph:
  requires:
    - packages/ai/src/generate-content.ts (07-01 cost-cap + tier routing pipeline)
    - packages/ai/src/index.ts (barrel for re-exports)
  provides:
    - packages/ai/src/pii-redactor.ts (redactPii, restoreFromTokens, PII_PATTERNS)
    - packages/ai/src/__tests__/pii-redactor.test.ts (27 TDD tests)
  affects:
    - packages/ai/src/generate-content.ts (redactPii wired before LiteLLM fetch)
    - packages/ai/src/index.ts (new exports: redactPii, restoreFromTokens, PII_PATTERNS, PiiRedactionResult)
    - packages/ai/src/__tests__/generate-content.test.ts (4 new PII redaction tests + 1 updated metadata test)
tech_stack:
  added: []
  patterns:
    - "PII redaction as pre-fetch transform: redactPii() applied to prompt + systemPrompt before leaving server"
    - "Deterministic token collapse: same value in one call gets same [TYPE_N] token"
    - "Opt-in re-identification: restoreFromTokens() not applied to LLM output (security default)"
    - "Pattern priority order: EMAIL > CARD > SSN > PHONE > IP (most-specific first, prevents collisions)"
key_files:
  created:
    - packages/ai/src/pii-redactor.ts
    - packages/ai/src/__tests__/pii-redactor.test.ts
  modified:
    - packages/ai/src/generate-content.ts
    - packages/ai/src/index.ts
    - packages/ai/src/__tests__/generate-content.test.ts
decisions:
  - "Pattern processing order EMAIL>CARD>SSN>PHONE>IP ensures compact CC numbers are not partially captured as IP or phone"
  - "metadata field always emitted in fetch body (with empty tags[] when no agencyId) — uniform body shape for LiteLLM"
  - "LLM output NOT auto-restored — restoreFromTokens is explicit opt-in by caller, never automatic"
  - "redactPii handles empty/falsy input gracefully (returns empty Map + passthrough) — no edge-case throws"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 3
  files_created: 2
  files_modified: 3
  commits: 3
---

# Phase 07 Plan 05: PII Redactor Summary

**One-liner:** PII redactor (REQ-084) strips email/phone/SSN/credit-card/IPv4 via regex tokens before every LiteLLM call, wired into generate-content.ts pre-fetch with deterministic duplicate collapse and opt-in restoreFromTokens.

## What Was Built

### packages/ai/src/pii-redactor.ts (new)

Five-pattern PII redaction module:

| Pattern | Regex strategy | Token format |
|---------|----------------|--------------|
| EMAIL | RFC-5321 localpart@domain.tld | `[EMAIL_N]` |
| CARD | 16-digit with optional space/dash separators | `[CARD_N]` |
| SSN | NNN-NN-NNNN | `[SSN_N]` |
| PHONE | US 10-digit, optional +1, parens, dots, dashes | `[PHONE_N]` |
| IP | Dotted-quad IPv4 | `[IP_N]` |

**Redaction example (before/after):**

```
Before: "Email: john@example.com, SSN: 123-45-6789, IP: 192.168.1.1"
After:  "Email: [EMAIL_1], SSN: [SSN_1], IP: [IP_1]"

replacements Map:
  EMAIL_1 → john@example.com
  SSN_1   → 123-45-6789
  IP_1    → 192.168.1.1
```

**Duplicate collapse example:**

```
Before: "From john@example.com to john@example.com"
After:  "From [EMAIL_1] to [EMAIL_1]"  (same value → same token)
```

**API:**

```typescript
redactPii(text: string): PiiRedactionResult
// Returns { redacted: string, replacements: Map<token, original> }

restoreFromTokens(text: string, replacements: Map<string, string>): string
// Opt-in re-identification — NOT applied to LLM output by default

PII_PATTERNS: { EMAIL, CARD, SSN, PHONE, IP }  // all RegExp instances
```

### packages/ai/src/__tests__/pii-redactor.test.ts (new)

27 tests across 10 describe blocks (A-J):

| Block | Tests | Coverage |
|-------|-------|----------|
| A. Email | 4 | single, two distinct, duplicate collapse, Map contents |
| B. Phone | 4 | formatted, dashed, international, bare 10-digit |
| C. SSN | 2 | standard, mid-sentence |
| D. Credit card | 3 | dashes, spaces, compact |
| E. IP address | 2 | private, public |
| F. Mixed PII | 2 | combined redaction, Map entries |
| G. No PII | 3 | clean text, empty Map, empty string |
| H. restoreFromTokens | 3 | single restore, empty Map, multiple tokens |
| I. PII_PATTERNS | 2 | all 5 keys, all RegExp instances |
| J. Order independence | 2 | CC not captured as IP, email+SSN no collision |

### packages/ai/src/generate-content.ts (modified)

Added redactPii call in the LiteLLM path:

```typescript
// Phase 7 — redact PII from prompt + systemPrompt before LiteLLM call (REQ-084)
const redactedPrompt = redactPii(prompt).redacted
const redactedSystemPrompt = redactPii(sysPrompt).redacted
```

Fetch body updated to use `redactedPrompt` and `redactedSystemPrompt`. LLM output is NOT auto-restored (security default — T-07-05-03 accepted).

Stub fallback path (no LITELLM_API_URL) is unchanged — no external call, no redaction needed.

### packages/ai/src/index.ts (modified)

Added exports:
```typescript
export { redactPii, restoreFromTokens, PII_PATTERNS } from './pii-redactor.js'
export type { PiiRedactionResult } from './pii-redactor.js'
```

### packages/ai/src/__tests__/generate-content.test.ts (modified)

4 new tests (describe block 8 — PII redaction before LiteLLM fetch):
- Email in prompt → fetch body contains `[EMAIL_1]`, not `john@example.com`
- PII in systemPrompt → fetch body system message has `[EMAIL_1]`
- Combined email + SSN → neither raw value in fetch body
- Stub path still works when LITELLM_API_URL is absent

1 updated test: "does not include metadata when agencyId is not provided" → now checks `metadata.tags` equals `[]` (metadata always emitted, tags empty when no agencyId).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `d9a07da` | test | add failing tests for pii-redactor (RED) |
| `c289146` | feat | pii-redactor with email/phone/ssn/cc/ip patterns (GREEN) |
| `a57f992` | feat | redactPii wired into generate-content before LiteLLM fetch |

## TDD Gate Compliance

- RED gate commit `d9a07da`: `test(07-05): add failing tests for pii-redactor (RED)` — confirmed fail with "Failed to load url ../pii-redactor.js"
- GREEN gate commit `c289146`: `feat(07-05): pii-redactor with email/phone/ssn/cc/ip patterns (GREEN)` — all 114 tests pass
- WIRE commit `a57f992`: `feat(07-05): redactPii wired into generate-content before LiteLLM fetch` — 118 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated metadata test to match plan's always-emit-metadata behavior**
- **Found during:** Task 3 test run
- **Issue:** Existing generate-content.test.ts test "does not include metadata when agencyId is not provided" checked `body.metadata === undefined`. The plan spec changes the fetch body to always emit `metadata: { tags: params.agencyId ? [...] : [] }` (uniform body shape). The old conditional spread `...(params.agencyId ? { metadata: ... } : {})` was replaced with always-present metadata.
- **Fix:** Updated the test assertion from `toBeUndefined()` to `toEqual([])` (checking the tags array is empty when no agencyId).
- **Files modified:** packages/ai/src/__tests__/generate-content.test.ts
- **Commit:** a57f992

## Security Review (STRIDE Threat Model)

| Threat | Mitigation |
|--------|-----------|
| T-07-05-01: PII leaked to LiteLLM provider logs | redactPii() applied to both prompt and systemPrompt before every fetch call |
| T-07-05-02: PII leaked to LLM training data | Same redaction path; LiteLLM provider data-retention contract is layer 2 |
| T-07-05-03: LLM output contains regenerated PII | Accepted — output NOT auto-restored; restoreFromTokens is explicit opt-in |
| T-07-05-04: Token collision (user types [EMAIL_1] literally) | Accepted — false positives unlikely; restoreFromTokens splits on exact `[TOKEN]` |

## Known Stubs

None. All plan goals achieved:
- pii-redactor.ts: full implementation with 5 PII pattern types
- generate-content.ts: redactPii wired before every LiteLLM fetch
- LLM output NOT auto-restored (security default confirmed)
- All tests green; typecheck exit 0

## Self-Check: PASSED

Files exist:
- packages/ai/src/pii-redactor.ts: FOUND
- packages/ai/src/__tests__/pii-redactor.test.ts: FOUND
- packages/ai/src/generate-content.ts (modified): FOUND
- packages/ai/src/index.ts (modified): FOUND
- packages/ai/src/__tests__/generate-content.test.ts (modified): FOUND

Commits exist:
- d9a07da: FOUND
- c289146: FOUND
- a57f992: FOUND

Test suite: 118/118 passing
Typecheck: exit 0

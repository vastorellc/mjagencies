---
phase: 07-ai-assistant
verified: 2026-04-27T04:39:47Z
status: human_needed
score: 4/5 roadmap success criteria verified (SC1 needs human)
overrides_applied: 0
gaps:
  - truth: "Payload migrate runs successfully and creates brand_voice + brand_glossary tables"
    status: failed
    reason: "No Postgres instance available in dev environment; migrate command fails on ECONNREFUSED 127.0.0.1:5432. No migrations/ directory exists, no evidence brand_voice or brand_glossary tables were created."
    artifacts:
      - path: "apps/web-main/migrations/"
        issue: "Directory does not exist — payload migrate was never successfully run"
    missing:
      - "Run `CI=true PAYLOAD_MIGRATING=true DATABASE_URL=<live-db> npx payload migrate` with a live Postgres instance"
      - "Verify brand_voice and brand_glossary tables exist via psql \\dt"
human_verification:
  - test: "Verify AI editor toolbar in Lexical editor — rewrite, draft, shorten, expand"
    expected: "AiPanel.tsx renders 4 action groups with all 20 buttons; clicking 'Rewrite' on selected text calls the rewriteSelection server action; loading state appears while generating; result text is shown in read-only textarea"
    why_human: "ROADMAP SC1 is a UI/behavioral check — requires the dev server running with a Payload admin session and editor access"
  - test: "Verify brand_voice and brand_glossary Payload collections visible in admin UI"
    expected: "Sidebar shows 'Branding' group with 'Brand Voice' and 'Brand Glossary' entries; new records can be created with the defined fields; brandVoiceRewrite action uses the brand context"
    why_human: "Plan 07-04 Task 3b is a blocking human checkpoint requiring admin UI + live database; Payload migrate was deferred due to no local Postgres"
  - test: "Verify stat without citation is blocked at publish"
    expected: "Saving a page with status=published and content containing '42%' with no nearby citation link throws an error and blocks save; draft with same content shows console.warn but saves"
    why_human: "CMS publish gate is a runtime behavior requiring a running Payload instance + editor session"
---

# Phase 7: AI Assistant + Anti-Fabrication Verification Report

**Phase Goal:** LiteLLM gateway with per-agency cost caps, 20 editor AI features, anti-fab guards, brand voice + glossary, PII redactor, prompt-injection protection.
**Verified:** 2026-04-27T04:39:47Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | AI rewrite/draft/shorten/expand work in Lexical editor | ? HUMAN NEEDED | AiPanel.tsx replaced with real actions wired via server actions; 20 functions present and connected. UI behavior requires human verification. |
| SC2 | Stat without source is blocked at publish | VERIFIED | `validateStatSources` in `packages/cms/src/hooks/anti-fab-validators.ts` throws on `status === 'published'` when no citation link within 150 chars; wired into `pages.ts` and `posts.ts` beforeOperation hooks |
| SC3 | Cost cap per agency enforced via LiteLLM budget manager | VERIFIED | `checkAgencyCostCap()` reads Redis `agency:<id>:ai:monthly-spend`, throws `AiBudgetExceededError` when `spent >= cap`; called in `generate-content.ts` before LiteLLM fetch; monthly reset cron registered in `instrumentation.node.ts` |
| SC4 | PII stripped from all LiteLLM calls | VERIFIED | `redactPii()` applied to both `guard.sanitized` (user prompt) and `sysPrompt` before every `fetch()` call in `generate-content.ts`; 5 pattern types: EMAIL, CARD, SSN, PHONE, IP |
| SC5 | AI content >70% triggers disclosure metadata; ratio computed per field with page-level sum | VERIFIED | `computeAiContentRatio` in `ai-disclosure.ts` reads `ai_generated_fields[]`, computes ratio over populated tracked fields (`title`, `content`, `meta_description`, `aio_tldr`), sets `ai_content_ratio` and `ai_disclosure_required = ratio > 0.70`; wired into both pages and posts collections |

**Score:** 4/5 roadmap truths verified (SC1 needs human UI test)

### Plan Must-Haves (Composite Across 6 Plans)

#### Plan 07-01 (REQ-080): LiteLLM Gateway + Cost Caps

| Truth | Status | Evidence |
|-------|--------|----------|
| generateContent() accepts agencyId and resolves per-agency LiteLLM API key | VERIFIED | `getAgencyLiteLLMKey()` reads `LITELLM_API_KEY_<AGENCY_UPPER>` with fallback to global key; called in `generate-content.ts` when agencyId provided |
| Monthly per-agency budget enforced via Redis counter; exceeding cap throws AiBudgetExceededError | VERIFIED | `checkAgencyCostCap()` in `cost-cap.ts` — reads `agency:<id>:ai:monthly-spend`, throws `AiBudgetExceededError` when spent >= cap |
| Successful LiteLLM responses increment Redis spend counter (estimated cents) | VERIFIED | `recordAgencySpend()` called after successful fetch; estimate: `Math.ceil(total_tokens * 0.0002)` cents |
| Model routing returns the correct model for each tier | VERIFIED | `MODEL_ROUTING` in `model-routing.ts`; tier1-bulk→gemini-2.5-flash-lite, tier2-writing→claude-sonnet-4-6, tier2-research→gemini-2.5-pro, tier3-max→claude-opus-4-6 |
| BullMQ cron at '0 0 1 * *' resets all agency monthly-spend counters | VERIFIED | `apps/web-main/src/jobs/cost-reset.ts` has cron `'0 0 1 * *'`, calls `resetMonthlySpend()`, registered via `registerCostReset()` in `instrumentation.node.ts`; Pitfall 7 dedup via `getRepeatableJobs()` present |

#### Plan 07-02 (REQ-081): 20 Editor AI Features

| Truth | Status | Evidence |
|-------|--------|----------|
| 20 AI server actions exist in ai-editor.ts, each starting with requireSession() + agencyId guard | VERIFIED | `grep -c "const session = await requireSession" ai-editor.ts` = 20; `grep -c "if (session.agencyId !== input.agencyId)"` = 20; `'use server'` directive confirmed |
| AiPanel.tsx replaces the Phase 5 stub and calls real server actions (no runStub) | VERIFIED | No `runStub` found in AiPanel.tsx; imports from `'../../../../../actions/ai-editor'`; 44 `var(--mj-*)` CSS tokens |
| Each action returns a typed result (AiEditorActionResult) with success/text/model fields | VERIFIED | `AiEditorActionResult { success, text, model, error? }` exported from `editor-actions.ts` and `index.ts` |
| Loading state and error boundary visible during generation | VERIFIED (partial) | AiPanel.tsx has 30 references to loading/error state; visual behavior needs human confirmation |
| Each action calls generateContent() with appropriate model tier | VERIFIED | aiRewrite/aiShorten/aiExpand/aiBrandVoiceRewrite use tier2-writing; all others use tier1-bulk |

#### Plan 07-03 (REQ-082, REQ-086, REQ-409): Anti-Fabrication Guards

| Truth | Status | Evidence |
|-------|--------|----------|
| validateStatSources blocks publish when stat has no nearby citation link | VERIFIED | STAT_PATTERNS array in `anti-fab-validators.ts`; throws on `isPublish` when no citation within 150 chars; ranges (30-45%) excluded via negative lookbehind |
| validateQuoteSources blocks publish when quoted text has no nearby citation | VERIFIED | Checks `"..."` strings (6+ chars) and lexical blockquote nodes; broader QUOTE_ATTRIBUTION_PATTERN accepts prose attribution |
| validateNoPlaceholders blocks publish on placeholder patterns | VERIFIED | PLACEHOLDER_PATTERNS covers `[insert*]`, `[TBD]`, `[TODO]`, `coming soon`, `lorem ipsum` — case-insensitive |
| computeAiContentRatio sets ai_content_ratio + ai_disclosure_required when ratio > 0.70 | VERIFIED | Dynamic denominator (`Math.max(populatedTracked, 1)`); `AI_DISCLOSURE_THRESHOLD = 0.70` exported constant |
| All four validators wired into pages collection beforeOperation hooks | VERIFIED | All 4 hooks confirmed present in `pages.ts` and `posts.ts`; existing 6 Phase 5/6 hooks preserved |

#### Plan 07-04 (REQ-083): Brand Voice + Glossary

| Truth | Status | Evidence |
|-------|--------|----------|
| brand_voice Payload collection exists with per-agency tone, style, formality fields | VERIFIED | `brand-voice.ts` exports `brandVoiceCollection` with slug `brand_voice`; 7 fields including fieldImmutable agency_id; admin group 'Branding' |
| brand_glossary Payload collection exists with per-agency term + avoid_phrases array | VERIFIED | `brand-glossary.ts` exports `brandGlossaryCollection` with slug `brand_glossary`; avoid_phrases array field with nested phrase entries |
| Both collections registered in CORE_COLLECTIONS array | VERIFIED | Both appear in `packages/cms/src/collections/index.ts` CORE_COLLECTIONS; payload.config.ts passes CORE_COLLECTIONS |
| getBrandVoiceContext(agencyId, payload) returns formatted system-prompt context for LLM | VERIFIED | Queries both collections in parallel with overrideAccess:true; formats TONE/STYLE/AUDIENCE/FORMALITY/GLOSSARY lines; error swallowed (graceful degradation) |
| Plan 07-02's brandVoiceRewrite server action loads brand context via getBrandVoiceContext | VERIFIED | brandVoiceRewrite in `ai-editor.ts` calls getBrandVoiceContext before aiBrandVoiceRewrite |
| Payload migrate runs successfully and creates brand_voice + brand_glossary tables | FAILED | No `apps/web-main/migrations/` directory; migrate deferred — ECONNREFUSED 127.0.0.1:5432 (no Postgres in dev). Tables have NOT been created. |

#### Plan 07-05 (REQ-084): PII Redactor

| Truth | Status | Evidence |
|-------|--------|----------|
| redactPii(text) replaces email/phone/SSN/credit card/IP with [TYPE_N] tokens | VERIFIED | `pii-redactor.ts` exports PII_PATTERNS with all 5 types; processing order EMAIL>CARD>SSN>PHONE>IP prevents collisions |
| Same PII value in input gets the SAME token | VERIFIED | `seen` Map (original→token) ensures duplicate values collapse to same token |
| redactPii returns { redacted, replacements } where replacements is a Map | VERIFIED | PiiRedactionResult interface with Map<string, string> replacements |
| generate-content.ts calls redactPii on params.prompt AND params.systemPrompt before fetch | VERIFIED | Lines 136-137 of generate-content.ts: `redactPii(guard.sanitized).redacted` and `redactPii(sysPrompt).redacted` |
| LLM output is NOT auto-detokenized (security default) | VERIFIED | No restoreFromTokens call anywhere in generate-content.ts or editor-actions.ts |

#### Plan 07-06 (REQ-085): Prompt-Injection Protection

| Truth | Status | Evidence |
|-------|--------|----------|
| guardPrompt(text) wraps user input in XML tags | VERIFIED | `wrapUserInput()` returns `<user_content>\n${text}\n</user_content>`; called when safe |
| guardPrompt returns { safe: false, reason } when jailbreak patterns detected | VERIFIED | All 10 JAILBREAK_PATTERNS confirmed; returns `{ safe: false, sanitized: '', reason: 'Prompt injection attempt detected' }` |
| Detected patterns include required jailbreak categories | VERIFIED | 10 patterns: ignore-instructions, you-are-now, act-as, pretend, DAN, developer-mode, system:, [SYSTEM], ###SYSTEM, </user_content>; plus escape-sequence heuristic |
| generate-content.ts calls guardPrompt() BEFORE redactPii(); throws PromptInjectionError if not safe | VERIFIED | Line order in generate-content.ts: guardPrompt (line 129) → redactPii (line 136) → fetch (line 139) |
| Server actions catch PromptInjectionError and return user-friendly error | VERIFIED | `editor-actions.ts` runAction catches `PromptInjectionError` → returns `{ success: false, text: 'This input cannot be processed. Please rephrase.', error: 'generation-failed' }` |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/ai/src/cost-cap.ts` | VERIFIED | 5 exports: checkAgencyCostCap, recordAgencySpend, getAgencyLiteLLMKey, resetMonthlySpend, AiBudgetExceededError |
| `packages/ai/src/model-routing.ts` | VERIFIED | ModelTier type, MODEL_ROUTING map, getModelForTier function |
| `packages/ai/src/generate-content.ts` | VERIFIED | All Phase 7 extensions: agencyId, tier, systemPrompt, guard→redact→fetch pipeline |
| `packages/ai/src/editor-actions.ts` | VERIFIED | 20 exported async ai* functions; AiEditorActionResult type |
| `packages/ai/src/brand-context.ts` | VERIFIED | getBrandVoiceContext(agencyId, payload) — queries both collections, overrideAccess:true |
| `packages/ai/src/pii-redactor.ts` | VERIFIED | redactPii, restoreFromTokens, PII_PATTERNS (5 types) |
| `packages/ai/src/prompt-guard.ts` | VERIFIED | guardPrompt, detectJailbreakAttempt, wrapUserInput, JAILBREAK_PATTERNS (10), PromptInjectionError |
| `packages/ai/src/index.ts` | VERIFIED | All Phase 7 exports present: cost-cap, model-routing, editor-actions, brand-context, pii-redactor, prompt-guard |
| `apps/web-main/src/actions/ai-editor.ts` | VERIFIED | 20 'use server' functions; all 20 with requireSession() + agencyId guard |
| `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` | VERIFIED | Real wiring; imports from `../../../../../actions/ai-editor`; 44 CSS tokens; no runStub |
| `apps/web-main/src/jobs/cost-reset.ts` | VERIFIED | registerCostReset(), cron '0 0 1 * *', resetMonthlySpend(), Pitfall 7 dedup |
| `packages/cms/src/hooks/anti-fab-validators.ts` | VERIFIED | validateStatSources, validateQuoteSources, validateNoPlaceholders |
| `packages/cms/src/hooks/ai-disclosure.ts` | VERIFIED | computeAiContentRatio, AI_DISCLOSURE_THRESHOLD = 0.70 |
| `packages/cms/src/collections/brand-voice.ts` | VERIFIED | brandVoiceCollection, slug brand_voice, 7 fields, Branding group |
| `packages/cms/src/collections/brand-glossary.ts` | VERIFIED | brandGlossaryCollection, slug brand_glossary, avoid_phrases array |
| `packages/cms/src/editor/ai-hooks-stub.ts` | VERIFIED | isStub: false; delegates to @mjagency/ai via dynamic import |
| `apps/web-main/migrations/` | MISSING | Directory does not exist — Payload migrate was deferred; brand_voice and brand_glossary tables have not been created |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `generate-content.ts` | `cost-cap.ts` | checkAgencyCostCap() before fetch; recordAgencySpend() after | WIRED |
| `generate-content.ts` | `pii-redactor.ts` | redactPii(guard.sanitized) and redactPii(sysPrompt) | WIRED |
| `generate-content.ts` | `prompt-guard.ts` | guardPrompt(prompt) before redactPii; throws PromptInjectionError | WIRED |
| `generate-content.ts` | `model-routing.ts` | getModelForTier(params.tier) | WIRED |
| `editor-actions.ts` | `generate-content.ts` | generateContent({ agencyId, tier, systemPrompt }) in runAction() | WIRED |
| `editor-actions.ts` | `cost-cap.ts` | AiBudgetExceededError caught in runAction catch block | WIRED |
| `editor-actions.ts` | `prompt-guard.ts` | PromptInjectionError caught in runAction catch block | WIRED |
| `ai-editor.ts` | `editor-actions.ts` | dynamic import('@mjagency/ai') per action | WIRED |
| `ai-editor.ts` | `@mjagency/auth requireSession` | first line of every server action | WIRED (20/20) |
| `AiPanel.tsx` | `ai-editor.ts` | imports from '../../../../../actions/ai-editor' | WIRED |
| `brandVoiceRewrite` in ai-editor.ts | `brand-context.ts` | getBrandVoiceContext(agencyId, payload) called before aiBrandVoiceRewrite | WIRED |
| `pages.ts` | `anti-fab-validators.ts` | beforeOperation hooks: validateStatSources, validateQuoteSources, validateNoPlaceholders | WIRED |
| `pages.ts` | `ai-disclosure.ts` | beforeOperation hook: computeAiContentRatio | WIRED |
| `posts.ts` | `anti-fab-validators.ts` | same 3 hooks appended | WIRED |
| `instrumentation.node.ts` | `cost-reset.ts` | await registerCostReset() | WIRED |
| `collections/index.ts` | `brand-voice.ts` + `brand-glossary.ts` | CORE_COLLECTIONS array | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `generate-content.ts` | LiteLLM API response | fetch() → LiteLLM /chat/completions | Yes (when LITELLM_API_URL set); stub otherwise | VERIFIED |
| `cost-cap.ts` | spent (Redis GET) | Redis `agency:<id>:ai:monthly-spend` counter | Real Redis query | VERIFIED |
| `brand-context.ts` | voiceRes, glossaryRes | payload.find({ collection: 'brand_voice/brand_glossary' }) | Real Payload local API queries | VERIFIED (code), DEFERRED (no DB tables yet) |
| `ai-disclosure.ts` | ai_content_ratio | data.ai_generated_fields[] populated by editor actions | Connected to form data | VERIFIED |
| `AiPanel.tsx` | lastResult | server action call → AiEditorActionResult.text | Connected through real server actions | VERIFIED (code), HUMAN for UI confirmation |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Pipeline order: guard before redact before fetch | `grep -n "guardPrompt\|redactPii\|fetch(" generate-content.ts` | guardPrompt at line 129, redactPii at line 136, fetch at line 139 | PASS |
| 20 server actions with requireSession | `grep -c "const session = await requireSession" ai-editor.ts` | 20 | PASS |
| 20 agencyId guards | `grep -c "if (session.agencyId !== input.agencyId)"` | 20 | PASS |
| AiPanel no runStub | `grep -q "runStub" AiPanel.tsx` | not found | PASS |
| JAILBREAK_PATTERNS array length | `awk '/JAILBREAK_PATTERNS/,/^\]/' | grep -c "^  /"` | 10 | PASS |
| All 5 PII pattern types | `grep -c "EMAIL:\|CARD:\|SSN:\|PHONE:\|IP:"` | 5 | PASS |
| AI editor in Lexical (UI) | Requires dev server | Not testable programmatically | SKIP |
| Payload migrate + DB tables | `ls apps/web-main/migrations/` | Directory does not exist | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REQ-080 | 07-01 | LiteLLM gateway — single instance, per-agency cost caps | SATISFIED | cost-cap.ts + generate-content.ts pipeline; BullMQ monthly reset cron |
| REQ-081 | 07-02 | 20 AI features in CMS editor | SATISFIED | 20 editor-actions functions + 20 server actions; AiPanel.tsx wired |
| REQ-082 | 07-03 | Anti-fabrication — stat detector, quote detector, placeholder lint | SATISFIED | All 3 validators in anti-fab-validators.ts; wired into pages + posts |
| REQ-083 | 07-04 | Brand voice + glossary + banned phrases per agency | PARTIALLY SATISFIED | Collections, context loader, server action wiring all complete; DB migrate deferred (no tables created yet) |
| REQ-084 | 07-05 | PII redactor before all LiteLLM calls | SATISFIED | redactPii wired into generate-content.ts before every fetch; 5 pattern types |
| REQ-085 | 07-06 | Prompt injection protection (XML wrapping + jailbreak classifier) | SATISFIED | guardPrompt with 10 patterns; XML wrapping; PromptInjectionError caught in editor-actions |
| REQ-086 | 07-03 | AI content disclosure when >70% AI-generated | SATISFIED | computeAiContentRatio sets ai_disclosure_required; AI_DISCLOSURE_THRESHOLD = 0.70 |
| REQ-409 | 07-03 | AI content ratio — calculated per field, page-level sum | SATISFIED | Dynamic denominator over TRACKED_FIELDS; ai_content_ratio set per document |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `packages/cms/src/editor/ai-hooks-stub.ts` | `aiSuggestInternalLinks` returns empty success with console.warn | INFO | Not in Phase 7 feature list; documented as Phase 8 scope in 07-02 SUMMARY. Not a blocker. |
| `packages/cms/src/editor/ai-hooks-stub.ts` | `aiAltText` returns empty success with console.warn | INFO | Same as above — Phase 8 scope. |
| `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` | "Insert at cursor" button described as stub — Lexical insertion deferred | INFO | Result shown in read-only textarea; Lexical cursor insertion is Phase 8. Not a blocker for Phase 7 goal. |

No blockers found. All stubs are intentionally deferred and documented in 07-02 SUMMARY.

### Human Verification Required

**1. AI Editor Toolbar — End-to-End Lexical Actions**

**Test:** Start dev server (`pnpm --filter @mjagency/web-main dev`). Open http://localhost:3000/admin. Navigate to Pages, edit any page. In the Lexical editor, select text and open the AiPanel. Click "Rewrite".
**Expected:** Loading indicator appears; server action fires; AI-generated text appears in the read-only result textarea. Error state shows correctly for "AI not configured" when LITELLM_API_URL is not set.
**Why human:** ROADMAP SC1 is a visual/interactive UI test requiring a running Payload admin session and editor context.

**2. Payload Migrate — brand_voice and brand_glossary Tables**

**Test:** With a live Postgres database, run `CI=true PAYLOAD_MIGRATING=true DATABASE_URL=<your-db-url> npx payload migrate` from `apps/web-main/`. Then verify `psql -c "\dt brand_voice"` and `\dt brand_glossary` return rows.
**Expected:** Migration completes with exit 0; both tables exist in the database. Payload admin shows "Branding" group with "Brand Voice" and "Brand Glossary" entries.
**Why human:** No local Postgres available in dev environment; migrate failed on ECONNREFUSED. Code is complete but tables have not been physically created. This is Plan 07-04's blocking must-have.

**3. Brand Voice + Glossary Admin UI and End-to-End**

**Test:** After migration (item 2 above), open Payload admin. Create one Brand Voice record (tone_description + formality_level). Create one Brand Glossary record with an avoid_phrases entry. Then test the "Brand Voice Rewrite" action on a paragraph in the editor.
**Expected:** Records save successfully; brand voice context is loaded into aiBrandVoiceRewrite system prompt. With LiteLLM configured, output reflects brand tone. Without LiteLLM, graceful "AI not configured" error.
**Why human:** Plan 07-04 Task 3b is a blocking human checkpoint. No evidence this checkpoint was ever completed — no "approved" signal found in any docs.

### Gaps Summary

**1 code gap (Payload migrate deferred):** The `brand_voice` and `brand_glossary` Payload collections are correctly defined in code and registered in CORE_COLLECTIONS, but `payload migrate` was never successfully run — no `apps/web-main/migrations/` directory exists. The collections exist as TypeScript definitions but not as database tables. This blocks the `getBrandVoiceContext()` runtime path from actually reading data (it would query tables that don't exist). Plan 07-04 explicitly marks this as a BLOCKING task with a human checkpoint (Task 3b) that has no evidence of completion.

**Resolution path:** Run `payload migrate` with a live Postgres instance. This is an environment constraint, not a code bug — all implementation is complete.

---

_Verified: 2026-04-27T04:39:47Z_
_Verifier: Claude (gsd-verifier)_

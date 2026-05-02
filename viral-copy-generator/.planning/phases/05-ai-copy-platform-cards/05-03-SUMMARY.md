---
phase: 05-ai-copy-platform-cards
plan: 03
status: complete
completed: 2026-05-02
wave: 2
---

# 05-03 Summary — prompt.ts + ai.ts (Three-Provider AI Routing)

## What Was Built

### Task 1: frontend/src/lib/prompt.ts

- `NICHE_HASHTAGS: Record<Niche, string[]>` — 8 niches × 15 real Pakistani creator hashtags (no placeholders — CLAUDE.md rule 5)
- `buildPrompt(signals, description, niche, options): string` — constructs AI prompt with:
  - Video signals section (when signals present, D-06)
  - Description section (when provided, D-06 both paths)
  - Second-pass section (when `options.scriptOutline` provided, D-05)
  - Niche hashtag bank injected (AI-07)
  - English + Urdu code-switching instruction (AI-08)
  - Exact D-03 JSON schema requirement in prompt output spec

### Task 2: frontend/src/lib/ai.ts

- `AI_OUTPUT_SCHEMA` — Gemini responseSchema mirroring D-03 AIOutput exactly (AI-06)
- `getGeminiConfig()` — returns `{ responseMimeType: 'application/json', responseSchema }` — BOTH fields required per AI-06
- `emptyAIOutput()` / `hydrateAIOutput()` — defensive defaults for all fields
- `parseAIOutput(raw)` — strips code fences, finds first `{` / last `}`, JSON.parse, hydrates (AI-09, T-5-02: never eval)
- `buildAICallParams(input)` — drops `frames` when `isSecondPass=true` (D-05, AI-11)
- `callAI(options)` — three-provider switch:
  - **Gemini**: Files API (upload → poll until ACTIVE → generateContent with both config fields), text-only when no file
  - **Claude**: `dangerouslyAllowBrowser: true` mandatory; raw base64 no data URI prefix; frames on first pass only
  - **OpenAI**: `proxyAIGenerate()` — never calls openai.com directly from browser (T-5-01, AI-05)

## Key Decisions

- `Content` type imported from `@google/genai` for strict Gemini contents typing (avoids `unknown[]` assignment error)
- `require('./ai')` in getGeminiConfig test replaced with top-level ESM import — `require` not available in Vitest ESM mode
- `gemini-2.5-flash` model for Gemini path (cost-efficient, vision-capable)
- `claude-sonnet-4-5` model for Claude path (balanced quality/cost)
- `gpt-4.1` for OpenAI proxy backend (set in 05-02 ai.ts route)

## Test Results

- ai.test.ts: 8/8 GREEN (was RED in Wave 0)
- Frontend full suite: 188/196 pass (8 RED = expected MQ checklist + PlatformCopyCard Wave 0 stubs)
- Frontend tsc: clean (only Wave 0 test file errors remain)

## Commits

- `ff5edd3` — feat(05-03): prompt.ts + ai.ts — three-provider AI routing

# Phase 9: Content Research Engine — Validation

**Generated from:** `09-RESEARCH.md` Validation Architecture section
**Phase:** 09-content-research-engine

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `backend/vitest.config.ts` |
| Quick run command | `cd backend && npm test -- --reporter=verbose tests/research*.test.ts` |
| Full suite command | `cd backend && npm test` |

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| RESEARCH-06 | Cache hit returns cached data; cache miss triggers fetch | unit | `npm test -- tests/research-cache.test.ts` | `backend/tests/research-cache.test.ts` |
| RESEARCH-06 | pg-boss refresh-trends job registers without crash | unit | `npm test -- tests/research-cache.test.ts` | `backend/tests/research-cache.test.ts` |
| RESEARCH-02 | YouTube fetcher returns TrendItem[] with correct shape (empty if key absent) | unit | `npm test -- tests/research-cache.test.ts` | `backend/tests/research-cache.test.ts` |
| RESEARCH-03 | Google Trends fetcher: success + CAPTCHA error both return valid shape | unit | `npm test -- tests/research-cache.test.ts` | `backend/tests/research-cache.test.ts` |
| RESEARCH-04 | Reddit fetcher: success + User-Agent header set | unit | `npm test -- tests/research-cache.test.ts` | `backend/tests/research-cache.test.ts` |
| RESEARCH-08 | AI prompt includes trend data + learning data | unit | `npm test -- tests/research-ai.test.ts` | `backend/tests/research-ai.test.ts` |
| RESEARCH-09 | AI response parsed into ContentIdeaData[] with all required fields | unit | `npm test -- tests/research-ai.test.ts` | `backend/tests/research-ai.test.ts` |
| RESEARCH-13 | GET /api/research/saved returns only authenticated user's saved ideas (RLS) | integration | `npm test -- tests/research.test.ts` | `backend/tests/research.test.ts` |
| RESEARCH-14 | POST /api/research/refresh enqueues pg-boss job | integration | `npm test -- tests/research.test.ts` | `backend/tests/research.test.ts` |

---

## Test File Map

| File | Plans That Make It GREEN | What It Covers |
|------|--------------------------|----------------|
| `backend/tests/research-cache.test.ts` | 09-02, 09-03 | getTrendCache, setTrendCache, all 4 trend fetcher shapes (YouTube, Google Trends, Reddit, ExplodingTopics) |
| `backend/tests/research-ai.test.ts` | 09-03 | buildResearchPrompt, safeParseIdeas (clean JSON, fenced JSON, malformed) |
| `backend/tests/research.test.ts` | 09-04 | niche allowlist validation, researchRouter structural assertion |

All three test stub files are created in RED state by Plan 09-01 Task 3 (Nyquist rule — contracts defined before implementation).

---

## Sampling Rate

| Trigger | Command |
|---------|---------|
| Per task commit | `cd backend && npm test -- --reporter=verbose tests/research*.test.ts` |
| Per wave merge | `cd backend && npm test` |
| Phase gate | Full suite green before `/gsd-verify-work 9` |

---

## Phase Gate Checklist

Before running `/gsd-verify-work 9`, confirm:

- [ ] `cd backend && npm test` passes (zero failures)
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd frontend && npm run build` completes without errors
- [ ] `grep -n "returning" backend/src/routes/research.ts` shows `.returning({ id: content_ideas.id })` (BLOCKER 1 fix)
- [ ] `grep -n "responseMimeType" backend/src/lib/research-ai.ts` shows `application/json` (WARNING 4 fix)
- [ ] `grep -n "idea\.id" frontend/src/pages/ResearchPage.tsx` shows IdeaCard using UUID (BLOCKER 1 fix)
- [ ] Human checkpoint in Plan 09-07 approved

---

## Wave 0 Requirements

These files must exist (in RED/stub state) before any implementation plans run:

- [ ] `backend/tests/research-cache.test.ts` — covers RESEARCH-06, trend fetcher shapes
- [ ] `backend/tests/research-ai.test.ts` — covers RESEARCH-08, RESEARCH-09 prompt + parse
- [ ] `backend/tests/research.test.ts` — integration: route handlers structural assertions
- [ ] `cd backend && npm install google-trends-api@4.9.2` — required for Google Trends fetcher

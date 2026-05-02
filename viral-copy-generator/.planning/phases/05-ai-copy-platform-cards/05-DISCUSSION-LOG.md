# Phase 5: AI Copy + Platform Cards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 05-ai-copy-platform-cards
**Areas discussed:** Card layout, AI output schema, Generate trigger + Phase 3 gap, Metadata Quality rules

---

## Card layout

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical stack | One card per platform, stacked top-to-bottom. All fields visible at once per card. User scrolls down to move between platforms. | ✓ |
| Horizontal swipe carousel | Cards side-by-side; user swipes to switch platform. Compact, keeps page short. | |
| Tab switcher | YT/IG/TT/FB/X tabs at top; one platform shown at a time. | |

**User's choice:** Vertical stack

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cards first, score below | Copy cards appear immediately after generation — user sees the value first. Score + checklist by scrolling down. | ✓ |
| Score first, cards below | Existing Phase 4 layout at top; copy cards added below the gap analysis. | |

**User's choice:** Cards first, score below

---

## AI output schema

| Option | Description | Selected |
|--------|-------------|----------|
| Nested by platform | `{ youtube: {…}, instagram: {…}, tiktok: {…}, facebook: {…}, x: {…}, script_outline: "…" }` — clean mapping to card fields. | ✓ |
| Flat with platform prefix | `{ youtube_title, youtube_description, instagram_caption, … }` — simpler to iterate. | |

**User's choice:** Nested by platform

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single tweet only | tweet (≤280 chars) + hashtags only for X card. Thread option deferred to Phase 10. | ✓ |
| Thread breakdown | thread: string[] (3-5 tweets). Adds value but complicates schema. | |

**User's choice:** Single tweet only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — always return script_outline | First response includes script_outline alongside platform outputs. "Get Better Version" appends it as improved_script_outline. | ✓ |
| No — summarise first response for second call | Backend summarises first response into a text block for the second call. | |

**User's choice:** Yes — always return script_outline

---

## Generate trigger + Phase 3 gap

| Option | Description | Selected |
|--------|-------------|----------|
| Both paths — description-only OR full analysis | Generate button always active. signals=null → description-only prompt. signals present → full signals + description + frames. | ✓ |
| Block on Phase 3 completion | Generate button hidden until analysis has run. | |
| Test-signals mock mode only | Only testable via __testSignals prop. | |

**User's choice:** Both paths simultaneously

---

| Option | Description | Selected |
|--------|-------------|----------|
| GeneratorPage holds both File + EngineSignals state | Phase 3 dropzone sets selectedFile + signals; Phase 5 reads both. Single source of truth. | ✓ |
| Phase 3 owns the file; passes to Phase 5 via props | More decoupled but adds prop-drilling. | |

**User's choice:** GeneratorPage holds both File + EngineSignals

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone file picker + description + Generate | Phase 5 adds minimal `<input type=file>` + description textarea + Generate button. Phase 3 replaces it. | ✓ |
| Description textarea + Generate only (no file picker) | Description-only until Phase 3 ships. Gemini Files API flow deferred. | |

**User's choice:** Standalone file picker + description + Generate

---

## Metadata Quality rules

| Option | Description | Selected |
|--------|-------------|----------|
| Pass if within per-platform limits | youtube.title ≤60 → pass; instagram.caption 150–200 → pass; tiktok.caption ≤150 → pass. | ✓ |
| Pass if AI returned non-empty field | Any non-empty string counts as pass. | |

**User's choice:** Per-platform character limits

---

| Option | Description | Selected |
|--------|-------------|----------|
| Presence check on dedicated AI output fields | hook_in_first_line: youtube.hook or tiktok.hook non-empty. cta_present: facebook.cta non-empty. | ✓ |
| Text pattern scan on the copy | Scan caption/description for CTA keywords and hook patterns. | |

**User's choice:** Presence check on dedicated fields

---

| Option | Description | Selected |
|--------|-------------|----------|
| Array length vs platform limits | IG: 25–30 → pass. TikTok: 4–6 → pass. YT: 10–15 → pass. | ✓ |
| Any hashtags present | Pass if hashtags array non-empty. | |

**User's choice:** Array length vs platform limits

---

| Option | Description | Selected |
|--------|-------------|----------|
| Pass if AI returned non-empty output | language_match_niche: instagram.caption non-empty. keyword_density: youtube.description non-empty. Trust the prompt. | ✓ |
| Basic keyword heuristics | Detect Urdu/Roman Urdu word in caption; check niche keyword in description. | |

**User's choice:** Pass if non-empty (trust the prompt)

---

## Claude's Discretion

- AI prompt wording and token budget
- Gemini responseSchema object structure
- Loading state text and animation
- Error display per AI error type
- Platform card Tailwind colour classes (exact shades)

## Deferred Ideas

- X thread breakdown → Phase 10 polish
- Language/keyword NLP for MQ items → Phase 10
- Per-provider prompt tuning → single unified prompt sufficient for Phase 5
- Streaming AI response → Phase 10

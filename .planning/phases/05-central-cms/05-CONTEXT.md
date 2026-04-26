# Phase 5: Central CMS + Block Library + Editor UX - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Mode:** Auto-generated (workflow.skip_discuss=true)

<domain>
## Phase Boundary

Payload CMS 3.82.1 embedded in Next.js, 45 blocks across 11 categories, Lexical rich-text editor with full toolbar + SEO/AIO/GEO sidebar, DAM with 3 views + 4 search modes, content sprint workstream kickoff.

**Success criteria (from ROADMAP):**
1. Payload admin loads at `/admin` without error (embedded via `withPayload`)
2. All 45 blocks render in editor across 11 categories
3. Lexical editor shows full fixed + inline toolbar with SEO/AIO/GEO sidebar (real-time scoring)
4. DAM upload→validate→publish flow works (3 views, multi-search modes)
5. Content sprint workstream produces at least 1 fully seeded agency
6. SVG uploads sanitized via DOMPurify + SVGO; word-count floors and FTC playbook disclaimer enforced

**Requirements covered:** REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061, REQ-062, REQ-063, REQ-201, REQ-203, REQ-205, REQ-207, REQ-305, REQ-410, REQ-411, REQ-412, REQ-421, REQ-505

**Plan stubs from ROADMAP:**
- 05-01: Payload 3.82.1 setup (`withPayload`, collections scaffold)
- 05-02: Core Payload collections — pages, posts, authors, categories, media (kicks off content sprint workstream)
- 05-03: 45-block library across 11 categories
- 05-04: Lexical editor — full toolbar, fixed+inline, SEO panel, AI hooks
- 05-05: DAM — library UX, 3 views, text/semantic/visual/color search, permissions vault, brand portal, living brand book
- 05-06: Content sprint workstream — LiteLLM drafts content per agency, REST API writes, validators on every save

</domain>

<decisions>
## Implementation Decisions

### Payload CMS setup (locked from mjagency/specs/cms.md)
- Payload CMS 3.82.1 EXACTLY PINNED — DO NOT UPGRADE (REQ-050)
- Embedded in Next.js 15 via `withPayload()` in `next.config.mjs` (REQ-051)
- Payload admin at `/admin` inside each agency app — use `(payload)` route group
- Config file: `payload.config.ts` at root of each app
- Single CMS admin access via `super_admin` role
- Per-agency scope enforced via `agency_id` + RLS (all collections have immutable `agency_id` field)

### Core collections (locked from cms.md)
All collections have: `agency_id` (immutable, `access.update = () => false`), `created_at`, `updated_at`, soft delete (`archived` state, not hard delete via API).

- **pages** — all website pages (home, about, services, etc)
- **posts** — blog posts
- **authors** — author profiles with Person JSON-LD schema
- **categories** — agency-scoped blog/content categories
- **media_assets** — DAM assets (images, video, SVG, documents)
- **tools** — tool pages + benchmark data
- **forms** — form definitions
- **redirects** — 301/302 redirects + broken link tracking
- **settings** — per-agency settings (brand voice, SEO defaults)
- **templates** — content templates library

### Draft/publish workflow (REQ-056, REQ-057, REQ-058)
- Draft → Review → Scheduled → Published states
- Scheduled publishing via BullMQ (already in `@mjagency/queue`) (REQ-057)
- 20 rolling revisions per content item (REQ-058) — diff view + one-click restore

### Global blocks (REQ-059)
- Global blocks: edit once, propagate everywhere
- Stored as separate collection `global_blocks` with reference in page blocks array

### 45 Blocks across 11 categories (REQ-052)
Exact list from cms.md:
- **Hero blocks (4):** hero-image, hero-video, hero-split, hero-minimal
- **Content blocks (8):** rich-text, two-column, three-column, image-text, text-image, stats-bar, quote-block, timeline
- **CTA blocks (5):** cta-full, cta-inline, cta-card, cta-floating, newsletter-cta
- **Service blocks (6):** service-grid, service-detail, process-steps, feature-list, comparison-table, pricing-table
- **Trust blocks (6):** client-logos, testimonials-grid, testimonials-slider, case-study-card, awards-bar, team-grid
- **Media blocks (5):** image-gallery, video-embed, video-hero, portfolio-grid, before-after
- **Blog blocks (4):** blog-grid, blog-featured, blog-related, author-bio
- **Tool blocks (3):** tool-embed, tool-result, tool-cta
- **Form blocks (2):** contact-form, newsletter-form
- **Utility blocks (2):** faq-accordion, divider

### Lexical editor features (locked from cms.md, REQ-053, REQ-054)
All features enabled via Payload Lexical feature registry:
```
FixedToolbarFeature(), InlineToolbarFeature(), BoldTextFeature(),
ItalicTextFeature(), UnderlineTextFeature(), StrikethroughTextFeature(),
InlineCodeTextFeature(), SubscriptFeature(), SuperscriptFeature(),
HeadingFeature({ enabledHeadingSizes: ['h1','h2','h3','h4','h5','h6'] }),
ParagraphFeature(), AlignmentFeature(), IndentFeature(),
UnorderedListFeature(), OrderedListFeature(), CheckListFeature(),
BlockquoteFeature(), HorizontalRuleFeature(), LinkFeature(),
UploadFeature(), TableFeature(), CodeHighlightFeature(),
TextColorFeature(), BackgroundColorFeature(), FontSizeFeature(),
ClearFormattingFeature(), SlashMenuFeature()
```

Slash menu commands: /h1-h6, /bullet, /numbered, /checklist, /quote, /code, /table, /image, /faq-block, /cta-block, /callout, /ai-write, /ai-expand, /ai-summarize

### Lexical editor sidebar panels (REQ-055)
- **Status panel:** Draft/Review/Scheduled/Published, visibility, publish date (BullMQ)
- **Author panel:** author picker, Person schema JSON-LD auto-gen
- **Meta panel:** featured image (4-tab picker), excerpt ≤160 chars, canonical URL, schema type
- **SEO/AIO/GEO panel (real-time):** overall score (0-100), AIO score, GEO score, meta title ≤60, meta description ≤160, AIO TL;DR ≤120 (required), focus keyword + density, heading structure, internal link count (warns <3), image alt coverage, word count vs floor, AI content ratio, originality score, one-click suggestions
- **Revisions panel:** 20 rolling saves, diff view, one-click restore

AI editor features (LiteLLM, Phase 7 wires real AI; Phase 5 wires the hooks + stubbed responses):
- AI rewrite, expand, shorten, brand voice rewrite, generate FAQ, suggest internal links, TL;DR auto-generate, meta description suggest, alt text for image

### DAM (REQ-060, REQ-061, REQ-062, REQ-063)
- **3 views:** super_admin (full library management), admin (agency-scoped management), editor picker (inline 4-tab picker: Upload/Library/Stock/AI)
- **Text search** — filename, alt text, caption, tags
- **Semantic search** — embedding-based similarity (vector index on caption + alt text)
- **Visual search** — CLIP-style embedding (Phase 5 stubs this; Phase 7 wires real model)
- **Color search** — dominant color + top-3 swatches (extracted at upload via LAB delta-E)
- **SVG sanitization:** DOMPurify + SVGO on every upload (REQ-305)
- **Brand portal (REQ-062):** external partner access via signed links (7-day expiry, agency-scoped)
- **Living brand book (REQ-063):** auto-rendered from Phase 4 tokens (theme.json + CSS vars)
- **BlurHash placeholder:** generated at upload; 32-char string stored on asset row
- Image pipeline: AVIF primary, WebP fallback, JPEG legacy; `Vary: Accept` CDN header

### Content validation rules (locked compliance)
- **Word count floors (REQ-201):** blog 1500+, service 1500+, tool 2200+ — enforced at publish
- **Internal links (REQ-203):** 3+ per article — enforced at publish (warning at draft)
- **Playbook numbers (REQ-205, REQ-411):** ranges only, exact figures blocked at publish
- **FTC disclaimer (REQ-207, REQ-410):** required on all composite playbook pages — exact text from FTC 2023
- **FTC testimonial (REQ-421):** testimonial disclaimer exact text required
- **Case study toggle (REQ-412):** `is_composite_playbook` boolean field; validation fires on flip to `true`

### Content sprint workstream (REQ-505)
- Starts after M005 slice 1.2 — i.e., plan 05-02 must complete first
- LiteLLM drafts content per agency (Flash-Lite model)
- REST API writes via Payload local API
- Validators run on every save (same word-count + FTC rules)
- Must produce at least 1 fully seeded agency before phase is complete

### Packages already existing (extend, don't replace)
- `packages/cms` — empty stub (`cmsPlaceholder()`); this phase fills it
- `packages/media` — empty, fill with DAM logic
- `packages/seo` — empty, fill with SEO scoring (basic stubs for Phase 5; Phase 6 does full plugins)
- `packages/queue` — encrypted BullMQ from Phase 1 (use for scheduled publishing)
- `packages/db` — withAgencyContext + RLS from Phase 2 (use for all CMS DB queries)
- `packages/auth` — requireSession() from Phase 3 (Payload access control hooks)
- `packages/ui` — 45 block React components will go in `packages/ui/src/blocks/`
- `packages/config` — AGENCIES const drives the 12 agencies

</decisions>

<canonical_refs>
## Canonical References

### Phase 1 outputs
- `packages/config/src/agency-constants.ts` — `AGENCIES` const (12 agency slugs)
- `packages/queue/src/encrypted-queue.ts` — BullMQ encrypted queue (use for scheduled publishing)
- `packages/config/src/logger.ts` — Pino logger (all CMS logging must use this)

### Phase 2 outputs
- `packages/db/src/client.ts` — `withAgencyContext()` (REQUIRED for all DB queries)
- `packages/db/src/schema/` — existing schema tables (Drizzle)
- `packages/db/src/migrate/apply-custom.ts` — `CUSTOM_FILES` (add any new SQL migrations here)

### Phase 3 outputs
- `packages/auth/src/require-session.ts` — `requireSession()` (required first line in all server actions)
- `packages/auth/src/middleware.ts` — `x-agency-id` header injected by middleware (Payload hooks read this)

### Phase 4 outputs
- `packages/ui/tokens/` — 6-layer CSS tokens (block components use these)
- `packages/ui/themes/default/` — 12 theme.json files (brand portal renders from these)
- `packages/ui/src/theme/validate-theme.ts` — theme validator (living brand book uses this)

### Project specs (primary source of truth for implementation)
- `mjagency/specs/cms.md` — full CMS + Lexical spec (collections, features, panels, 45 blocks)
- `mjagency/specs/media.md` — DAM spec (image pipeline, color matching, blur hash, budgets)
- `mjagency/CLAUDE.md` — project rules

</canonical_refs>

<specifics>
## Specific Ideas

- Payload `access` control pattern: all collection access functions call `requireSession()` first, then check `payload.req.user.agencies` includes the `agency_id` of the doc
- Block components: each block is a `React.FC<BlockProps>` in `packages/ui/src/blocks/<category>/<BlockName>/`. All CSS via `--mj-*` tokens. No hex literals.
- SEO panel scoring stub: Phase 5 wires the UI and returns placeholder scores (0-100 mock); Phase 6 installs the real plugin engine
- LiteLLM in content sprint: calls go through `@mjagency/ai` package (empty stub from Phase 1); Phase 5 adds a `generateContent()` function using `LITELLM_API_URL` env var with flash-lite model
- Payload local API for content sprint writes: use `payload.create()` / `payload.update()` — no HTTP round-trip
- BlurHash: use `blurhash` npm package at upload time; store result in `blur_hash` string column on media_assets
- Color extraction: use `color-thief-node` at upload time; store `dominant_color` + `swatches` JSON array on media_assets
- SVG sanitization: `dompurify` + `svgo` npm; run in Node.js server action (not Edge); validate MIME type before sanitizing
- FTC disclaimer exact text: `"Results not typical. Individual results may vary based on [market conditions/industry/niche]."` — enforced at publish via Payload `beforeOperation` hook

</specifics>

<deferred>
## Deferred Ideas

- Visual page builder (Puck) — deferred to M010 builder phase (described in cms.md but out of Phase 5 scope)
- Real CLIP visual search model — Phase 7 wires actual model; Phase 5 stubs the endpoint
- AI editor features with real LiteLLM calls — Phase 7; Phase 5 stubs responses
- Stock image picker (4-tab picker: Upload/Library/Stock/AI) — Stock + AI tabs deferred to Phase 5 (they are in Phase 5 scope, but the AI generation tab → Phase 7)
- Brand portal external partner portal UI — Phase 5 implements the backend (signed links, JWT); the full portal UI is M010
- Per-user content revisions (beyond 20) — post-launch

</deferred>

---

*Phase: 05-cms-block-library*
*Context auto-generated: 2026-04-26 via workflow.skip_discuss=true*

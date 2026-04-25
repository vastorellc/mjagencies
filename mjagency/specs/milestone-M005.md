MILESTONE M005 - CENTRAL CMS + BLOCKS + EDITOR UX
Branch: milestone/M005-cms-blocks-editor
Model: claude-sonnet-4-6
Depends on: M004 complete
CRITICAL: Read specs/cms.md and specs/content.md fully first.

GOAL: Payload 3.82.1 running, 45 blocks built, Lexical editor configured,
      DAM functional, content sprint workstream started.

SLICES:

SLICE 1: Payload 3.82.1 Setup (REQUIRED FIRST - content sprint depends on this)
  Task 1.1: payload.config.ts base (packages/cms)
    - Payload 3.82.1 EXACT (verify in package.json before starting)
    - withPayload() in each app's next.config.mjs
    - Database adapter: Drizzle (postgres)
    - Admin: /admin route
    - Collections scaffold (empty, defined in next slice)
  Task 1.2: Core Payload collections
    - pages collection (agency_id, slug, status, blocks, seo fields)
    - posts collection (agency_id, title, content, author, categories, seo)
    - authors collection (agency_id, name, bio, photo, sameAs, credentials)
    - categories collection (agency_id, name, slug, description)
    - media_assets collection (agency_id, all DAM metadata fields)
    - tools collection (agency_id, tool config + benchmark data)
    - settings collection (agency_id, brand voice, SEO defaults)
    All: agency_id immutable (access.update = () => false)
    All: RLS via Drizzle adapter
  >>> CONTENT SPRINT WORKSTREAM STARTS HERE <<<
    (starts running in parallel after Task 1.2 complete)

SLICE 2: 45 Block Library
  Task 2.1: Hero blocks (4)
    hero-image, hero-video, hero-split, hero-minimal
    Each: full field schema, React component, dark mode, mobile-first
  Task 2.2: Content blocks (8)
    rich-text, two-column, three-column, image-text, text-image,
    stats-bar, quote-block, timeline
  Task 2.3: CTA blocks (5)
    cta-full, cta-inline, cta-card, cta-floating, newsletter-cta
  Task 2.4: Service + Trust blocks (12)
    service-grid, service-detail, process-steps, feature-list,
    comparison-table, pricing-table, client-logos, testimonials-grid,
    testimonials-slider, case-study-card, awards-bar, team-grid
  Task 2.5: Media + Blog blocks (9)
    image-gallery, video-embed, video-hero, portfolio-grid, before-after,
    blog-grid, blog-featured, blog-related, author-bio
  Task 2.6: Tool + Form + Utility blocks (7)
    tool-embed, tool-result, tool-cta, contact-form, newsletter-form,
    faq-accordion, divider
  Each block: loading state, error state, empty state, WCAG AA compliant

SLICE 3: Lexical Editor Full Config
  Task 3.1: Editor feature setup (see specs/cms.md for full list)
    FixedToolbarFeature + InlineToolbarFeature (both enabled)
    All text formatting: bold, italic, underline, strikethrough, code
    Heading H1-H6, paragraph, alignment, indent
    Lists: unordered, ordered, checklist
    Blockquote, horizontal rule
    Link, image (with 4-tab picker), table, code highlight
    Text color picker (brand palette tokens + custom hex)
    Font size (preset scale matching type tokens)
    Slash command menu (/ commands)
    Markdown shortcuts enabled
  Task 3.2: SEO/AIO/GEO sidebar panel
    Real-time scoring engine integration (from packages/seo)
    Score updates on every content change (debounced 500ms)
    All fields: title, description, TL;DR, focus keyword, etc
    See specs/cms.md for full sidebar panel spec
  Task 3.3: AI features in editor (packages/ai)
    All 20 AI features wired to LiteLLM
    Flash-Lite for inline edits, Sonnet for long-form
    Brand voice + glossary loaded per agency

SLICE 4: DAM (Digital Asset Management)
  Task 4.1: Library UX (3 views)
    super_admin global view: all agencies
    per-agency portal: own agency only
    editor picker: scoped by editor_grants
  Task 4.2: Search
    Meilisearch: full-text on filename + alt + tags
    pgvector: semantic search on descriptions
    Color search: LAB delta-E matching
    Saved smart collections
  Task 4.3: Upload pipeline
    Single file drop -> sanitize -> SVGO (SVGs) -> derive variants
    -> BlurHash -> color extraction -> validators -> save to R2
  Task 4.4: Permissions vault UI
    File upload (PDF) linked to asset
    Expiry tracking, publish gates enforced

SLICE 5: Visual Page Builder (Puck)
  Task 5.1: Puck setup (packages/builder)
    Puck wired to all 45 block components
    Block config: fields, variants, render functions
  Task 5.2: Admin bar component
    Fixed top bar (48px), z-index 9999
    Enable/Disable toggle (body class, no reload)
    Meta panel (right drawer, SEO scores)
    Preview, Save draft, Publish buttons
    Cookie-gated (UI only), server-side auth check mandatory
  Task 5.3: Puck save via server action
    Server action: auth() check + agencyId ownership check (FIRST LINES)
    Saves block JSON to Payload pages collection
    Triggers ISR cache tag purge on publish

CONTENT SPRINT WORKSTREAM (runs parallel after SLICE 1 Task 1.2):
  Separate GSD-2 workstream: "content"
  Uses LiteLLM Flash-Lite for all content drafting
  Writes to Payload CMS REST API
  Per agency: blog posts (3), service pages (3-5), FAQ (10+), about, contact,
              legal pages, 404, all meta titles/descriptions, tool page content
  Validators run on every save
  See scripts/seed-plan.md for full order

SUCCESS CRITERIA:
  Payload admin loads at /admin without error
  Payload version confirmed 3.82.1 (automated check)
  All 45 blocks render in Payload admin block picker
  Lexical editor: full toolbar visible, SEO panel updates in real-time
  DAM: upload -> validate -> publish flow complete
  Puck: builder toggle works, meta panel opens, save goes to Payload
  Puck: server action blocked without auth (Vitest test)
  Content sprint: at least 1 agency has complete content seeded

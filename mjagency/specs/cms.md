specs/cms.md - MJAgency CMS Spec

==============================================================
CMS ENGINE
==============================================================
Payload CMS 3.82.1 (PINNED - DO NOT UPGRADE)
Embedded inside Next.js 15 via withPayload()
Payload admin at /admin
Single CMS ADMIN access (super_admin role)
Per-agency scope enforced via agency_id + RLS

withPayload setup in next.config.mjs:
  import { withPayload } from '@payloadcms/next/withPayload'
  export default withPayload(nextConfig)

Payload config location: payload.config.ts (root of each app)

==============================================================
CORE COLLECTIONS (ALL WITH agency_id)
==============================================================
pages          - All website pages (home, about, services, etc)
posts          - Blog posts
authors        - Author profiles with Person schema
categories     - Agency-scoped blog/content categories
media_assets   - DAM assets (images, video, SVG, documents)
tools          - Tool pages + benchmark data
forms          - Form definitions
redirects      - 301/302 redirects + broken link tracking
settings       - Per-agency settings (brand voice, SEO defaults)
templates      - Content templates library

All collections:
  - agency_id field: immutable, access.update = () => false
  - created_at, updated_at timestamps
  - Soft delete (archived state, not hard delete via API)

==============================================================
LEXICAL RICH TEXT EDITOR CONFIG
==============================================================
Features enabled:
  FixedToolbarFeature()      - Top fixed toolbar (always visible)
  InlineToolbarFeature()     - Appears on text selection
  BoldTextFeature()
  ItalicTextFeature()
  UnderlineTextFeature()
  StrikethroughTextFeature()
  InlineCodeTextFeature()
  SubscriptFeature()
  SuperscriptFeature()
  HeadingFeature({ enabledHeadingSizes: ['h1','h2','h3','h4','h5','h6'] })
  ParagraphFeature()
  AlignmentFeature()
  IndentFeature()
  UnorderedListFeature()
  OrderedListFeature()
  CheckListFeature()
  BlockquoteFeature()
  HorizontalRuleFeature()
  LinkFeature()
  UploadFeature()            - Image insert with 4-tab picker
  TableFeature()
  CodeHighlightFeature()
  TextColorFeature()         - Brand palette tokens + custom hex
  BackgroundColorFeature()
  FontSizeFeature()          - Preset scale matching theme type tokens
  ClearFormattingFeature()
  SlashMenuFeature()         - / command menu

Slash menu commands:
  /h1 /h2 /h3 /h4 /h5 /h6
  /bullet /numbered /checklist
  /quote /code /table /image
  /faq-block /cta-block /callout
  /ai-write /ai-expand /ai-summarize

AI features inside editor (LiteLLM):
  AI rewrite (Flash-Lite, 3 variants)
  AI expand selection (Flash-Lite)
  AI shorten selection (Flash-Lite)
  AI brand voice rewrite (Flash-Lite)
  AI generate FAQ from content (Flash-Lite)
  AI suggest internal links (embeddings + Flash-Lite)
  AI TL;DR auto-generate (Flash-Lite)
  AI meta description suggest (Flash-Lite)
  AI alt text for image (Flash-Lite)

==============================================================
LEXICAL EDITOR SIDEBAR PANELS
==============================================================
Status panel:
  - Draft / Review / Scheduled / Published
  - Visibility (public/private/password)
  - Publish date (scheduled via BullMQ)

Author panel:
  - Author picker (from authors collection)
  - Auto-generates Person schema JSON-LD

Meta panel:
  - Featured image (4-tab picker)
  - Excerpt (<=160 chars, meta description fallback)
  - Canonical URL
  - Schema type selector

SEO/AIO/GEO panel (always visible, real-time):
  - Overall SEO score (0-100, color-coded, live update)
  - AIO score (AI Mode citation readiness)
  - GEO score (generative engine optimization)
  - Meta title (<=60 chars, character count)
  - Meta description (<=160 chars)
  - AIO TL;DR (<=120 chars, required)
  - Focus keyword + density indicator
  - Heading structure validator
  - Internal link count (warns if <3)
  - Image alt coverage (%)
  - Word count vs floor
  - AI content ratio
  - Originality score
  - Last reviewed date
  - One-click suggestions

Revisions panel:
  - 20 rolling saves
  - Diff view between versions
  - One-click restore

==============================================================
45 BLOCKS (ALL CATEGORIES)
==============================================================
Hero blocks (4):
  hero-image, hero-video, hero-split, hero-minimal

Content blocks (8):
  rich-text, two-column, three-column, image-text,
  text-image, stats-bar, quote-block, timeline

CTA blocks (5):
  cta-full, cta-inline, cta-card, cta-floating, newsletter-cta

Service blocks (6):
  service-grid, service-detail, process-steps,
  feature-list, comparison-table, pricing-table

Trust blocks (6):
  client-logos, testimonials-grid, testimonials-slider,
  case-study-card, awards-bar, team-grid

Media blocks (5):
  image-gallery, video-embed, video-hero, portfolio-grid, before-after

Blog blocks (4):
  blog-grid, blog-featured, blog-related, author-bio

Tool blocks (3):
  tool-embed, tool-result, tool-cta

Form blocks (2):
  contact-form, newsletter-form

Utility blocks (2):
  faq-accordion, divider

==============================================================
VISUAL PAGE BUILDER (PUCK)
==============================================================
Library: Puck (MIT, open-source, React-native)
Deployment: Lazy-loaded, cookie-gated, zero impact on public visitors
Auth: Server-side session check (not cookie-only)

Admin bar (fixed top, 48px):
  - Property logo + name (left)
  - Current page breadcrumb (left)
  - Enable/Disable toggle (center-left) - CSS class on body, no reload
  - Edit mode label (center)
  - Meta button -> right drawer with SEO panel
  - Preview button -> new tab with draft token
  - Revert button -> reverts to last published
  - Save draft button
  - Publish button -> ISR cache tag purge
  - Exit builder (far right)

Keyboard shortcut: Cmd+E / Ctrl+E toggles builder

Inline editing:
  - Text (H1-H6, paragraph): click -> contenteditable
  - Rich text: TipTap inline editor
  - Image: click -> 4-tab picker (Upload/Library/Stock/AI)
  - Button text: contenteditable
  - Block reorder: drag handle (left side)
  - Add block: + between blocks -> library drawer
  - Block actions: duplicate, delete, variant picker

Meta panel (right drawer, 400px):
  - Page title, meta description, OG title, OG description
  - OG image picker
  - Canonical URL, robots (noindex/nofollow toggles)
  - Schema type selector
  - SEO/AIO/GEO score widget (real-time)
  - AIO TL;DR field
  - Last reviewed date
  - Breadcrumb label

Save format: Block JSON -> Payload REST API -> ISR tag purge

Scope isolation:
  - Main brand: edits brand.com pages only
  - Each agency: edits own agency pages only
  - agency_id check on every save (server action level)
  - RLS enforced at DB layer

Draft/publish:
  - Auto-save every 30s (BullMQ async)
  - Preview: signed URL, 1h expiry
  - Publish: ISR cache tag purge, <60s propagation
  - Conflict: WebSocket detects concurrent edit, shows warning

==============================================================
DAM (DIGITAL ASSET MANAGEMENT)
==============================================================
Three views:
  super_admin global  - All 12 agencies, all assets
  per-agency portal   - Own agency only
  editor picker       - Scoped by editor_grants, read-only, search

Library taxonomy:
  brand-identity / imagery / illustrations / icons / video /
  templates / documents

Search types:
  Text search (Meilisearch)
  Semantic (embeddings + pgvector)
  Visual similarity (CLIP embeddings)
  Color match (LAB delta-E)
  Filter combo (property + category + permission status)
  Saved smart collections

Metadata layers:
  Technical:    auto-extracted (dimensions, format, file size, palette)
  Descriptive:  AI-suggested (LiteLLM) + admin-confirmed
  Governance:   permissions, expiry, usage rights
  Performance:  usage count, conversion lift, fatigue score

Workflow states:
  draft -> pending_review -> approved -> published -> paused -> archived -> deleted

AI compliance agent (continuous):
  - Daily: off-brand color drift, missing alt text
  - Weekly: stock-photo detection, stale benchmarks
  - Monthly: creative fatigue detection (>90 days same hero)
  - Quarterly: orphan assets (0 usage in 90 days)
  - On upload: duplicate detection

Living brand book (per agency):
  - Auto-renders from theme tokens + assets
  - Sections: logos, colors, typography, voice, imagery, icons, illustrations
  - Updates automatically when tokens or assets change
  - Replaces static brand PDF

==============================================================
CONTENT VALIDATORS (PUBLISH GATES)
==============================================================
Word count floor:
  blog: 1500 min / 2500 recommended
  service: 1500 min / 2500 recommended
  tool page: 2200 min
  cornerstone blog: 3000 min / 5000 recommended
  FAQ entry: 100 min / 250 recommended
  legal page: 1500 min

Other validators:
  Originality: <70% similar to known web content
  Cannibalization: no 2 pages targeting same intent
  Placeholder text: blocks lorem, TODO, [insert], Coming soon
  Internal links: >=3 per article
  External citations: >=1 per major claim
  Alt text: required, >=10 chars, meaningful
  AIO TL;DR: required on all indexable pages
  FAQ schema: required on FAQ-eligible pages
  AI content disclosure: required when >70% AI-generated
  Last reviewed date: required
  Author + Person schema: required on long-form
  Stat sourcing: every stat needs citation
  Playbook numbers: ranges only, not exact figures

==============================================================
PAYLOAD ADMIN SECURITY
==============================================================
- X-Robots-Tag: noindex on all /admin routes
- robots.txt: Disallow: /admin
- Cloudflare WAF: /admin whitelisted IPs only
- Payload admin not linked from any public page
- Admin URL: /admin (not a custom path, Payload default)
- Payload 3.82.1: custom view exact: true on all collection views
  (workaround for 3.83.0 route matching bug)

==============================================================
IMPORTANT CONSTRAINTS
==============================================================
Yjs real-time collaboration: DEFERRED to v2.
At v1: Payload Lexical editor is single-user (one editor at a time).
Conflict detection: if two sessions edit same page simultaneously,
  show warning banner "Another session is editing this page".
  Implemented via BullMQ soft lock (not Yjs CRDT).
  Lock expires after 5 minutes of inactivity.
  No real-time cursor sharing at v1.

Payload 3.82.1 custom view workaround (v3.83.0 bug):
  ALL custom collection views must use exact: true in view config.
  Without this, route prefix matching is inverted (3.83.0 regression).
  This is a pinned-version constraint — fixed in Payload 3.82.1.
  Do not upgrade Payload until this is confirmed fixed upstream.

==============================================================
CMS V1 SCOPE (LOCKED)
==============================================================
Build in v1:
  SEO/AIO/GEO inline scoring (all 3 plugins)
  draft -> review -> publish workflow
  scheduled publishing (BullMQ)
  reusable global blocks
  image alt text enforcement
  content templates library
  broken link checker + redirect manager
  20 rolling revisions per content item
  Puck visual page builder (admin bar, meta panel)
  Full Lexical editor (all toolbar features)

Defer to v2:
  Role-locked sections (different editors for different blocks)
  Content audit dashboard (per-page health history)
  Yjs real-time collaboration
  Multi-tenant Payload instances with shared UI (not needed, separate apps)
  Page-level A/B testing (use theme A/B instead)

Skip entirely:
  Page-level A/B via CMS (theme A/B handles this)

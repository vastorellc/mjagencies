specs/builder.md - MJAgency Visual Page Builder + CMS Post Editor

Two distinct editing systems. Both write to Payload CMS via REST API.
Both share draft/publish workflow. Different surfaces, different users.

==============================================================
SYSTEM OVERVIEW
==============================================================

System A: VISUAL PAGE BUILDER (Puck)
  Surface:  Live frontend pages (rendered Next.js site)
  Users:    admin (own agency), super_admin (any agency)
  Purpose:  Visual drag-and-drop layout + inline text/image edits
  Engine:   Puck (MIT, open-source, React-native, Tailwind-compatible)

System B: CMS POST EDITOR (Payload Lexical)
  Surface:  Payload /admin panel
  Users:    admin, editor (CMS scoped by editor_grants)
  Purpose:  Long-form content authoring (posts, pages, service copy)
  Engine:   Payload 3 Lexical (built-in, Meta open-source)

Both systems:
  - Save as JSON to Payload CMS (never raw HTML)
  - Use same draft -> publish workflow
  - Use same ISR tag purge on publish
  - Are scoped by agency_id (RLS enforced)
  - Lazy-load builder JS (zero bytes for public visitors)


==============================================================
SYSTEM A: VISUAL PAGE BUILDER (PUCK)
==============================================================

DEPLOYMENT
  Library:         Puck (latest stable, MIT)
  Load strategy:   Lazy-loaded JS bundle, cookie-gated
  Cookie:          mjagency_builder=1 (set on admin login)
  Public visitors: Builder JS never ships to non-admin users
  Auth gate:       Server-side session check renders Puck component
                   Cookie = UI convenience only, NOT access control
  Agency scope:    Server action verifies agency_id ownership on every save

ADMIN BAR (FIXED TOP, 48px, z-index: 9999)
  Left:
    Property logo + subdomain name
    Current page breadcrumb (click = navigate)

  Center-left:
    Enable/Disable toggle (CSS class swap on <body>, no reload)
    Keyboard shortcut: Cmd+E / Ctrl+E
    State stored in sessionStorage, resets on new session

  Center:
    Edit mode label: "Editing — Draft" or "Editing — Published"

  Center-right:
    Meta button      -> opens meta panel right drawer
    Preview button   -> /preview?draft=true&token=<signed> (1h expiry)

  Right:
    Revert           -> reverts to last published state (confirmation modal)
    Save draft       -> BullMQ async save, SSE progress
    Publish          -> ISR cache tag purge + confirmation modal
    Exit builder     -> removes bar, full live view

  Behavior:
    Bar: position fixed, 48px height
    Page gets padding-top: 48px when bar active
    Dark/Light: matches system preference
    Fully keyboard-navigable, ARIA landmarks
    Screen reader announces "editing mode active" on toggle

INLINE EDITING CAPABILITIES
  Element              How
  Heading (H1-H6)      Click -> contenteditable activates
  Paragraph            Click -> contenteditable
  Rich text block      Click -> TipTap inline editor
  Button text          Click -> contenteditable
  Button URL           Click -> link picker modal
  Image                Click -> 4-tab picker (Upload/Library/Stock/AI Generate)
  Block reorder        Drag handle left side -> up/down
  Add block            Click + between blocks -> block library drawer (slides in)
  Delete block         Block toolbar -> delete -> confirmation
  Duplicate block      Block toolbar -> duplicate
  Block variant        Block toolbar -> variant picker (layout A/B)
  Global blocks        Inline edit -> propagates all instances -> confirmation modal

FLOATING MINI-TOOLBAR (text selection)
  Appears: above selected text, 36px tall, dismisses on click-outside
  Controls:
    Bold, Italic, Underline
    Link (URL picker + new tab toggle + rel)
    AI rewrite (Flash-Lite, 3 variants inline, pick one)
    AI shorten (Flash-Lite inline)
    AI expand  (Flash-Lite inline)
    Clear formatting
    Character count (live, warns at threshold)

META PANEL (right drawer, 400px wide)
  Opens from admin bar Meta button, stays over live page

  Field               Detail
  Page title          <title> + og:title, <=60 chars, live character count
  Meta description    <meta name="description">, <=160 chars, live count
  OG image            Upload/pick from library, preview shown
  OG title            Override for social (auto-copies from title)
  OG description      Override for social (auto-copies from meta desc)
  Canonical URL       Editable, validated (same-origin check)
  Robots              noindex/nofollow toggles
  Schema type         Article/Service/FAQPage/HowTo/etc (auto-selected)
  SEO score widget    0-100, color-coded, live update on every keystroke
  AIO score           AI Mode citation readiness
  GEO score           Generative engine optimization readiness
  AIO TL;DR           <=120 chars, required field
  Last reviewed date  Editable, auto-updates on publish
  Breadcrumb label    Navigation breadcrumb text
  Save meta           Saves fields only, does NOT trigger full publish

  SEO score updates: real-time, debounced 500ms
  Same scoring engine as CMS Lexical panel

IMAGE REPLACEMENT FLOW
  1. Click image -> blue border + "Replace image" overlay button
  2. 4-tab picker opens: Upload / Library / Stock / AI Generate
  3. Pick -> image previewed in-place immediately
  4. Validation: AVIF/WebP derived, DeltaE niche check, alt text prompt
  5. Alt text: prompt appears inline, cannot save without it
  6. Confirm -> image replaces in-place, draft auto-saved

DRAFT + PUBLISH FLOW
  Auto-save:          Every 30s while editing, BullMQ async job
  Manual save draft:  Save draft button, immediate
  Preview:            /preview?draft=true&token=<signed>, ISR bypassed, 1h expiry
  Publish:            Triggers revalidateTag('agency:<id>:page:<slug>')
                      Live within 60s via Cloudflare CDN propagation
  Revision history:   20 rolling saves, accessible from admin panel (not builder UI)
  Conflict detection: WebSocket per page, shows warning if concurrent edit detected

SCOPE ISOLATION
  Instance            Scope
  brand.com builder   Main brand pages only (super_admin)
  agency.brand.com    That agency's pages only (admin for that agency)
  super_admin         Can enter builder on any property via admin panel
  admin               Own agency only
  editor              Cannot enter builder (CMS /admin only)
  Enforcement:        agency_id check in server action (first line) + RLS at DB

PUCK SECURITY RULES
  - Puck component rendered ONLY after server-side session verification
  - Auth cookie enables UI toggle only — auth happens server-side
  - Puck saves via server action with mandatory auth + agency_id check:
      const session = await auth()
      if (!session) throw new Error('Unauthorized')
      if (session.agencyId !== pageAgencyId) throw new Error('Forbidden')
  - Puck outputs JSON, never dangerouslySetInnerHTML
  - All block components sanitize string inputs before rendering
  - contenteditable input sanitized via DOMPurify before save
  - No raw HTML stored in DB — only structured block JSON

AI ASSIST INSIDE BUILDER
  Trigger                     Action                   Model
  Select text -> AI rewrite   3 variants inline pick   Flash-Lite
  Low AIO score headline      Suggest alternative      Flash-Lite
  Image alt missing           Auto-generate from img   Flash-Lite
  Meta description empty      Draft from H1+para       Flash-Lite
  Content thin warning        Suggest expansion        Flash-Lite
  All AI calls routed via LiteLLM gateway, cost-tagged per agency

ACCESSIBILITY
  Admin bar: fully keyboard-navigable, ARIA landmarks
  Edit mode: focus ring on all editable elements (3px offset)
  Drag handles: keyboard accessible (arrow keys to reorder)
  Modals: focus trapped, ESC closes
  Screen reader: announces mode changes
  Reduced motion: drag animations disabled (prefers-reduced-motion)
  Contrast: admin bar passes WCAG AA both light + dark

PERFORMANCE
  Builder JS bundle:   Lazy-loaded, 0 bytes for public visitors
  Load trigger:        Cookie mjagency_builder=1 (set on admin login only)
  Public site impact:  Zero — builder JS never included in public bundle
  Save operations:     BullMQ async, non-blocking, SSE progress indicator
  ISR purge:           Tag-based, <60s to live
  Conflict detection:  Lightweight WebSocket per page

BUILD PLACEMENT
  Phase 4 (M004): Puck config wired to design token system, block variants mapped
  Phase 10 (M010): Builder core — admin bar, meta panel, SEO score widget,
                   draft/publish, image picker, AI assist hooks
                   Builder JS lazy-loaded on frontend, cookie-gated
                   ISR purge integration
  Phase 11 (M011): Builder usage analytics, revision count dashboard


==============================================================
SYSTEM B: CMS POST EDITOR (PAYLOAD LEXICAL)
==============================================================

ENGINE
  Library:  Payload 3 Lexical (built-in, Meta open-source)
  Config:   lexicalEditor({ features: [...] }) in Payload collection config
  Toolbar:  Fixed (always visible top) + Inline (on selection) both enabled
  Save:     Editor JSON -> Payload DB -> serialized to React on render
  XSS:      DOMPurify sanitizes HTML output from rich text converter
            Never dangerouslySetInnerHTML from user content

FIXED TOOLBAR FEATURES (ALL ENABLED)
  Bold, Italic, Underline, Strikethrough
  Inline code
  Subscript, Superscript
  Headings H1-H6 (dropdown)
  Paragraph (dropdown)
  Text alignment: Left, Center, Right, Justify
  Indent, Outdent
  Unordered list, Ordered list, Checklist
  Blockquote
  Horizontal rule
  Insert link (URL + new tab + rel picker)
  Insert image (4-tab picker: Upload/Library/Stock/AI Generate)
  Insert table (column + row picker)
  Insert embed (YouTube, Vimeo, custom iframe)
  Insert code block (language selector)
  Text color (brand palette tokens + custom hex)
  Background highlight (color picker)
  Font size (preset scale matching theme type tokens)
  Undo, Redo (Cmd+Z / Cmd+Shift+Z)
  Clear formatting
  Word count (live in toolbar)
  Reading time (calculated live)

  Markdown shortcuts enabled:
    # H1, ## H2, ### H3
    **bold**, _italic_, ~~strikethrough~~
    --- horizontal rule, > blockquote
    - bullet list, 1. ordered list

POST EDITOR LAYOUT
  Top action bar (full width):
    <- Back | [Post title field] | Save Draft | Publish

  Main content area (left, ~70% width):
    Fixed toolbar (always visible)
    Post title (large input, maps to H1)
    Slug field (/services/my-post, auto-generated, editable)
    Rich text body (Lexical editor, full feature set)
    FAQ block (appended below body)

  Sidebar (right, ~30% width):
    Status panel
    Author panel
    Meta panel
    SEO/AIO/GEO panel (always visible, real-time)
    Revisions panel

SIDEBAR PANELS (DETAIL)

  Status panel:
    Draft / Review / Scheduled / Published
    Visibility: Public / Private / Password-protected
    Publish date: datetime picker, scheduled via BullMQ

  Author panel:
    Author picker (from authors collection)
    Auto-generates Person schema JSON-LD on select

  Meta panel:
    Categories: agency-scoped, multi-select, create inline
    Tags: freeform, multi-select
    Featured image: 4-tab picker, alt text required, BlurHash preview
    Excerpt: <=160 chars, used as meta description fallback
    Canonical URL: editable, validated
    Schema type: Article/BlogPosting/HowTo/FAQPage/CaseStudy (auto-selected)
    Template: pick from content templates library
    Reading time: auto-calculated from word count

  Revisions panel:
    20 rolling saves
    Diff view between any two versions
    One-click restore to any revision

SEO/AIO/GEO PANEL (ALWAYS VISIBLE, REAL-TIME)
  Overall SEO score:        0-100, color-coded (red <40 / amber 40-70 / green >70)
  AIO score:                AI Mode citation readiness
  GEO score:                Generative engine optimization readiness
  Meta title:               Custom or auto from H1, <=60 chars + live count
  Meta description:         Custom or auto from excerpt, <=160 chars + live count
  AIO TL;DR:                <=120 chars, required, feeds AI Mode
  Focus keyword:            Primary keyword, density shown inline
  Keyword in title:         Pass/fail indicator
  Keyword in first 100w:    Pass/fail indicator
  Internal links count:     Live count, warns if <3
  External links count:     Pass/fail per sourced claim
  Image alt coverage:       % of images with alt, warns at <100%
  FAQ schema:               Present/missing indicator
  H1 present:               Pass/fail
  Heading structure:        Logical/issues detected
  Word count:               Live count vs floor for page type
  AI content ratio:         % AI-generated, disclosure triggered at >70%
  Originality:              Similarity score vs known web content
  Last reviewed date:       Editable field
  Suggestions:              Actionable, one-click apply where possible
  Update frequency:         Real-time, debounced 500ms on every keystroke
  Scoring engine:           Same package as builder meta panel (packages/seo)

SLASH COMMAND MENU
  Trigger: type / anywhere in body
  Categories:
    Text:    /p /h1 /h2 /h3 /h4 /h5 /h6 /quote /code
    Lists:   /bullet /numbered /checklist
    Media:   /image /video /table
    Content: /faq /cta /callout /divider
    AI:      /ai-write /ai-expand /ai-summarize

AI WRITING FEATURES (INSIDE EDITOR)
  Feature                   Trigger                  Model
  Write paragraph           /ai-write -> prompt      Sonnet
  Expand selection          Select -> AI expand      Flash-Lite
  Shorten selection         Select -> AI shorten     Flash-Lite
  Rewrite in brand voice    Select -> AI rewrite     Flash-Lite
  Generate FAQ from content Sidebar button           Flash-Lite
  Suggest internal links    Sidebar button           Embeddings + Flash-Lite
  AIO TL;DR auto-generate   Sidebar one-click        Flash-Lite
  Suggest meta description  Sidebar one-click        Flash-Lite
  Alt text for image        On image insert          Flash-Lite
  Cost-capped per agency/month via LiteLLM budget manager


==============================================================
BUILDER vs POST EDITOR COMPARISON
==============================================================

Feature               Visual Builder (Puck)         CMS Post Editor (Lexical)
Surface               Live frontend site             /admin panel
Users                 admin, super_admin             admin, editor
Best for              Layout + visual tweaks         Long-form content authoring
Toolbar               Floating mini on selection     Fixed bar always visible
SEO panel             Meta drawer (admin bar)        Full sidebar panel always visible
Image insert          Replace existing slots         In-body insert (Lexical Upload)
Block insert          Puck block library drawer      Lexical block nodes (/ menu)
Draft/publish         Same backend, visual UI        Same backend, admin UI
Revision history      Via /admin panel               Via sidebar revisions panel
AI assist             Floating mini-toolbar          Slash menu + sidebar buttons
Data format           Block JSON (Puck schema)       Editor JSON (Lexical schema)
XSS protection        DOMPurify on contenteditable   DOMPurify on HTML output
Auth gate             Server action + session check  Payload native auth
Scope                 agency_id in server action     Payload field-level access

Both write to Payload CMS via REST API.
Both use ISR tag purge on publish.
Both lazy-load editor JS (zero bytes for public visitors).


==============================================================
BUILD PLACEMENT SUMMARY
==============================================================

Milestone  What gets built
M004       packages/ui tokens wired -> Puck block variants mapped to theme tokens
M005       Payload Lexical config: all features enabled, SEO sidebar wired,
           AI hooks stubbed, image picker (4-tab) integrated, slash menu
M006       SEO/AIO/GEO scoring engine -> wired to both Lexical panel + Puck meta panel
M007       AI features inside editor: all 20 features active, anti-fabrication guards
M010       Puck builder: admin bar, meta panel, inline edit, drag-reorder,
           image replacement flow, draft/publish, cookie-gate, lazy-load,
           ISR purge integration, conflict detection WebSocket
M011       Builder analytics: most-edited blocks, revision count dashboard,
           AI assist usage per agency

SUCCESS CRITERIA (BOTH SYSTEMS)
  Lexical editor: all toolbar features functional (Playwright test clicks each)
  Lexical SEO panel: score updates within 500ms of keystroke
  Puck builder: admin bar visible on live site for authenticated admin
  Puck toggle: enable/disable switches in <100ms (no reload)
  Puck save: draft saves within 2s, publish within 60s on CDN
  Agency isolation: editor on agency A cannot save to agency B (403 test)
  AI rewrite: 3 variants shown inline within 3s (Playwright test)
  Meta panel: all fields save correctly (integration test)
  Placeholder linter: blocks "TODO" at publish (Vitest test)
  No dangerouslySetInnerHTML from user content anywhere (ESLint rule)

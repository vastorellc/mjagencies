specs/media.md - MJAgency Media Catalog Spec

==============================================================
TOTAL MEDIA AT V1 LAUNCH
==============================================================
Logos (13 variations x 12 properties):    ~156
Hero images/videos:                        ~235
Niche illustrations (30 per agency):      ~360
Real photography (team, office, etc):     ~360-470
Icons (120 Lucide + 227 custom):          ~347
Videos:                                    ~40-80
TOTAL:                                    ~1,500-1,650 assets

Auto-derived variants (sizes, formats, crops): ~10,000+ files

==============================================================
IMAGE PIPELINE
==============================================================
Primary format:  AVIF
Fallback:        WebP
Legacy:          JPEG
Header:          Vary: Accept (CDN serves correct format)
No dangerouslyAllowSVG on Next.js Image (security rule)

Responsive delivery pattern:
  <picture>
    <source media="(max-width: 640px)" type="image/avif"
            srcset="img-mobile-540.avif 540w, img-mobile-750.avif 750w"
            sizes="100vw">
    <source media="(max-width: 640px)" type="image/webp" ...>
    <source type="image/avif" srcset="img-1280.avif 1280w, img-1920.avif 1920w">
    <source type="image/webp" ...>
    <img src="img-1280.jpg" fetchpriority="high" loading="eager"
         decoding="async" width="1920" height="900"
         style="background-color: var(--hero-dominant-color)"
         alt="...">
  </picture>

LCP preload (single hero per page):
  <link rel="preload" as="image" type="image/avif"
        href="hero-desktop.avif"
        imagesrcset="hero-1280.avif 1280w, hero-1920.avif 1920w"
        imagesizes="100vw" fetchpriority="high"
        media="(min-width: 641px)">

BlurHash placeholder:
  Generated at upload
  32-char string stored on asset row
  CSS background fills space instantly (no white flash)
  200ms fade transition when real image loads

Performance budgets:
  Hero AVIF desktop:      <180 KB (warn at 120 KB)
  Hero AVIF mobile:       <100 KB (warn at 70 KB)
  Team portrait AVIF:     <150 KB
  Inline avatar AVIF:     <80 KB
  Thumbnail AVIF:         <30 KB
  Office interior AVIF:   <180 KB
  Hero video:             <2 MB, max 8 seconds, muted
  Video poster (AVIF):    <100 KB
  OG image (PNG):         <80 KB
  LCP target:             <1.8s desktop, <2.2s mobile

==============================================================
COLOR SCHEME MATCHING (ALL ASSETS)
==============================================================
Two-stage process:
1. Shoot/create with niche fingerprint LUT/style
2. Upload validation: Cloudflare Images extracts dominant + top-3 swatches
   LAB delta-E <=25 vs agency color.brand.* tokens = PASS
   > 25 = warn or block (per niche guardrail severity)

Per-niche guardrails:
  finance:     no neon, must be muted navy/green palette
  ai:          no warm yellow, must be violet/cool spectrum
  branding:    bold black + warm accent allowed
  engineering: charcoal + amber accent only
  (all niches have locked palette rules)

On color mismatch:
  - Admin sees side-by-side comparison
  - System suggests CSS overlay (brand color at 5-15% opacity, mix-blend-mode: multiply)
  - Admin one-click applies overlay
  - Adjacent section bg: extracted dominant color used for seamless blend
  - AI compliance agent re-validates on every theme token change

Image sources (hybrid model):
  Real photos:     Team, founder, testimonial, case study, client logos, office, awards
  Stock images:    Unsplash, Pexels, Pixabay (API), Freepik, Burst (manual paste)
                   For: abstract hero, backgrounds, service tiles, blog featured
  AI-generated:    Firefly, Recraft, Midjourney (via LiteLLM)
                   For: abstract hero, backgrounds, empty states, 404
                   BANNED: any image with AI humans on trust surfaces
  Custom illust:   Single illustrator for all agencies (cohesion)
                   For: service icons, process icons, niche illustrations

Stock API proxy (SECURITY - keys never in browser):
  /api/media/search?source=unsplash&q=...
  Allowlist: images.unsplash.com, images.pexels.com, cdn.pixabay.com, img.freepik.com

AI image rules:
  Allowed:  abstract concepts, backgrounds, patterns, decorative spots, empty states
  Banned:   any identifiable humans on team/testimonial/case study/about/office
  Disclosure: "AI-generated" tag in metadata + schema
  Generators: Adobe Firefly, Recraft (SVG-capable), Midjourney via LiteLLM
  Guardrail:  AI face detector runs on every upload (Hive + open-source)
  Artifacts:  Hand/finger/text glitch detector flags for review

==============================================================
HERO IMAGES
==============================================================
Per slot:
  hero_image_desktop_light  (1920x900 AVIF)
  hero_image_desktop_dark   (dark variant if dark mode enabled)
  hero_image_mobile_light   (750x940 AVIF, portrait crop)
  hero_image_mobile_dark
  hero_video_desktop        (optional, <2MB, muted loop, <8s)
  hero_video_poster_desktop (AVIF, <100KB)
  hero_alt                  (required, meaningful)
  hero_blurhash             (auto-generated)
  hero_dominant_color       (auto-extracted)
  hero_palette              (top-3 swatches, auto)
  hero_focal_point_x_y      (0-1 float, default 0.5/0.5)
  hero_overlay              (optional: {token, opacity})

CMS authoring:
  Drop one source file -> CF Images derives all variants automatically
  Mobile crop tool: visual picker for portrait crop
  Focal point picker: click to set
  Live preview: mobile + tablet + desktop + light + dark

Niche hero treatment:
  main:        architectural/abstract, neutral
  ecommerce:   real product + dashboard overlay
  growth:      dashboard/chart/funnel, data-forward
  webdev:      code/UI/device mockup, clean precision
  ai:          abstract data/network/particle, soft motion
  branding:    editorial/packaging shots, cinematic
  strategy:    editorial/boardroom, authoritative
  finance:     charts/documents, clean professional
  engineering: blueprints/industrial, precise
  product:     sketches/prototypes, IDEO-adjacent
  video:       cinematic stills/scrubbing, fullscreen
  graphic:     typographic/kinetic, editorial

==============================================================
NICHE ILLUSTRATIONS
==============================================================
Format: SVG only
Count: 30 per agency x 12 = 360 total at v1

Token-driven color model:
  --ill-primary   -> --color-brand-primary
  --ill-secondary -> --color-brand-secondary
  --ill-accent    -> --color-accent
  --ill-neutral   -> --color-text-secondary
  --ill-bg        -> --color-surface
  --ill-shadow    -> --color-shadow-low

All paths use var(--ill-*), NO hardcoded hex colors.
Theme switch = instant (CSS variable update only).
Dark mode = automatic (token swap).
Validator blocks hex literals at upload.

Pipeline:
  Upload -> SVGO + token transformer -> style fingerprint check -> ΔE check
  Token transformer rewrites fill="#hex" -> fill="var(--ill-*)"
  Inline if <5KB, <img> tag if >5KB

Anatomy:
  Canvas: 800x600 default, 600x600 for tiles, 1200x800 for empty states
  Padding: 8% safe zone
  Stroke weight: 1.5px at 24px viewBox
  Color count: max 4 colors
  Single focal point

==============================================================
PHOTOGRAPHY
==============================================================
Categories (real only, no stock/AI people):
  Founder portraits  - Required for About, author bios
  Team portraits     - Required for team page
  Group team photo   - About page, home (subtle)
  Office interior    - About, contact
  Workspace/process  - About, process page
  Real client logos  - With written permission
  Testimonial portraits - With written permission, FTC compliant
  Case study materials - Real deliverables, approved by client

Style fingerprint per niche (photographer brief):
  main:        natural soft directional, neutral warm (3200K)
  ecommerce:   bright clean, saturated accent, products foregrounded
  growth:      clean cool, indigo/purple grade, dashboards visible
  webdev:      bright cool, desaturated blue, screens + devices
  ai:          soft directional, violet warm grade
  branding:    dramatic chiaroscuro, bold black + warm cream
  strategy:    controlled even, navy + gold cool
  finance:     clean even daylight, navy + green muted
  engineering: natural daylight, charcoal + amber accent
  product:     warm soft window light, cream + coral
  video:       film-style anamorphic, warm contrasty
  graphic:     dramatic, bold high-contrast

Photographer brief:
  LUT file per niche (delivered to photographer for color grade)
  Shot list: 8-15 shots per property
  Aspect ratios: 3:4 (portrait mobile), 16:9 (landscape desktop), 1:1 (square)
  Permission forms ready on shoot day
  Buyout license: unlimited commercial use, 12 properties + future
  Delivery: RAW + edited AVIF/JPEG + all crop variants

Permissions vault (per real photo):
  model_release, client_logo, testimonial, case_study, BTS, awards
  Minimum 5-year scope
  Encrypted file storage
  Expiry alerts at 30 days
  Publish gate: blocked without permission for restricted categories

Anti-fabrication:
  AI face detector: blocks AI humans at upload
  Stock hash check: blocks known stock library photos
  Skin retouch cap: max 10% (no AI face replacement)
  Permission gate: blocks publish without consent file

Fallbacks (when real photos not ready):
  Team/founder missing: initials avatar with brand color
  Office missing: niche illustration of workspace
  Client logo missing: hidden (never placeholder)
  Testimonial missing: hidden (never fabricated)
  Group photo missing: hidden until shot

==============================================================
ICON SYSTEM
==============================================================
UI icons: Lucide React (MIT, 1500+, tree-shaken)
  Import: import { Search } from 'lucide-react' (per-icon ONLY)
  sideEffects: false in package.json
  Custom additions: per-agency, ~72 total custom UI icons
  Grid: 24x24, 1.5px stroke, currentColor

Service icons: 48x48, per-niche style, token vars (--icon-primary, --icon-accent)
Process icons: 64x64, per-niche style, numbered variants

Delivery:
  UI icons: React components (inline for Chrome/Edge) + external sprite (Safari)
  Service + process: External sprite per agency (single request, cached forever)
  Sprite path: /sprites/<agency>/service-icons.svg

Token model:
  --icon-primary   -> --color-brand-primary
  --icon-accent    -> --color-accent
  --icon-neutral   -> --color-text-secondary
  (+ success, warning, danger semantic tokens)

ARIA model (3-state):
  Decorative:   <svg aria-hidden="true">
  Labeled:      <button aria-label="Search"><svg aria-hidden="true">
  Described:    <svg role="img" aria-labelledby="t d"><title id="t">...</title>

==============================================================
VIDEO STRATEGY
==============================================================
Hosting:
  Self-hosted: Cloudflare Stream (short loops, case studies)
  Embeds: YouTube/Vimeo via facade pattern (lite-youtube-embed)

Facade pattern (mandatory for all YouTube/Vimeo embeds):
  Initial: poster image + play button overlay
  Click: loads actual iframe
  Reason: prevents ~600KB JS payload on page load

Formats: MP4 H.264 primary + WebM VP9 fallback
Captions: WebVTT mandatory for all spoken content (human-reviewed)
Transcript: auto-generated, stored alongside video, indexed

Save-Data / reduced motion:
  No autoplay anywhere except hero
  prefers-reduced-motion: video paused, poster shown

Allowed surfaces:
  Hero (cinematic agencies), case study, tool intro, service explainer,
  about founder message, testimonials (with permission), blog embeds,
  video agency reel, graphic agency portfolio

Banned surfaces:
  Footer, background autoplay (anywhere except hero), loading screens

Schema:
  VideoObject auto-generated
  Transcript indexed
  Captions in schema
  Video sitemap auto-generated per agency

==============================================================
ASSET GOVERNANCE (DAM)
==============================================================
See specs/cms.md for full DAM spec.

Key rules:
  Permissions vault: every real photo linked to permission file
  AI compliance agent: continuous scans for drift + expiry
  Orphan detection: 90-day no-usage -> super_admin review
  Creative fatigue: >90 days same hero -> refresh flag
  Version history: 20 versions per asset, 1-click rollback
  Audit log: hash-chained, 7yr retention

Storage:
  R2: raw originals
  Cloudflare Images: transformed variants
  Cloudflare Stream: video encoding + HLS
  Cache tags: agency:<id>:asset:<id>
  Cold storage: after 90 days inactive

==============================================================
MEDIA MOCK (LOCAL DEV)
==============================================================
packages/media-mock:
  Used when NEXT_PUBLIC_USE_MEDIA_MOCK=true (local dev only)
  Returns: placeholder AVIF URLs from picsum.photos (or local fixture files)
  Generates: deterministic BlurHash from URL hash
  Extracts: dominant color from fixed palette
  Never calls: Cloudflare Images API
  Controlled by: NODE_ENV === 'development' check in packages/media

==============================================================
PERMISSION FORM TEMPLATES
==============================================================
All permission forms pre-built in scripts/seed/permissions/:

model-release.pdf:
  - Full name, date of birth confirmation (18+)
  - Signature + date
  - Scope: unlimited commercial use, 12 properties + future
  - Duration: minimum 5 years
  - Compensation: stated (even if $0 / gifted session)
  - Image review: subject may request to see images before use

client-logo.pdf:
  - Company name, authorized signatory name + title
  - Logo file description
  - Scope: digital only, named properties
  - Duration: minimum 2 years

testimonial-release.pdf:
  - Name, company, role
  - Testimonial text (attached/quoted)
  - Approval to use verbatim or with light editing
  - FTC disclosure consent
  - Duration: minimum 5 years

case-study-release.pdf:
  - Client company name, authorized signatory
  - Project description + dates
  - Results approved for disclosure
  - FTC attestation (results are real and representative)
  - Duration: minimum 5 years

All forms: pre-filled with agency name, stored in R2 (public read, signed download).
Owner downloads form, gets signature, uploads to permissions vault.

==============================================================
ACCESSIBILITY: IMAGE GUIDELINES
==============================================================
Alt text rules (enforced at publish):
  Decorative images: alt="" (empty, explicit)
  Informative images: describe what is shown (not "image of")
  Functional images (buttons): describe the action ("Search")
  Complex images (charts): describe the data, not the visual
  Minimum: 10 characters (validator enforces)
  Maximum: 125 characters (screen reader practical limit)
  Forbidden: "image of", "picture of", "photo of", filename as alt

Screen reader testing:
  VoiceOver (macOS/iOS): tested on all P0 pages in M012 QA
  NVDA (Windows): tested on all P0 pages in M012 QA
  All images: verified announced correctly

==============================================================
VIDEO CAPTION REQUIREMENTS
==============================================================
All videos with spoken content: WebVTT captions mandatory.
Caption quality: human-reviewed (not raw auto-generated).
Accuracy: >99% accuracy required.
Format: .vtt file uploaded alongside video in DAM.

Process:
  1. Upload video to Cloudflare Stream
  2. Auto-captions generated (Stream feature)
  3. Human review + correction (freelancer or AI-assisted)
  4. Upload corrected .vtt to DAM
  5. Publish blocked if captions not linked

Caption metadata in DAM:
  has_captions: boolean
  caption_language: varchar(5) default 'en'
  caption_reviewed_by: varchar(255)
  caption_reviewed_at: timestamptz

specs/website-ui.md - MJAgency Website UI + Page Anatomy

All 12 agencies (main brand + 11 subagencies). Senior UI/UX level.
Core Web Vitals + technical SEO baked into every UI decision.
Fully responsive. Every element editable from admin.

==============================================================
GLOBAL UI STANDARDS (ALL 12 AGENCIES)
==============================================================
Design level:    Senior 10yr UI/UX — nothing generic, nothing low-effort
Responsive:      Mobile-first, tested at 320px / 375px / 768px / 1280px / 1920px
Touch targets:   Minimum 48px on mobile
Animations:      prefers-reduced-motion respected on all transitions
Dark mode:       Full dark mode on all agencies (token-driven, no asset reload)
Focus:           Visible focus rings on ALL interactive elements (3px offset)
Typography:      System font stack as fallback; variable font primary
Font loading:    font-display: optional for LCP fonts, swap for body text
Render blocking: Zero render-blocking fonts or scripts
CLS:             0.00 — all images have width + height; no layout shift ever
LCP:             <1.8s desktop / <2.2s mobile — hero image always preloaded
INP:             <200ms — all interactions debounced or deferred

==============================================================
NAVIGATION — HEADER (ALL AGENCIES)
==============================================================
Header type: Sticky (desktop) + slide-down on scroll-up (mobile)
Height:      72px desktop / 64px mobile
Background:  Glassmorphism blur (backdrop-filter: blur(16px)) with bg-surface/90
Border:      1px bottom border at --color-border-subtle
Shadow:      box-shadow token on scroll (none at top)
Z-index:     1000 (below Puck admin bar at 9999)

Left:
  - Logo (SVG, links to /)
  - Tagline (desktop only, optional, below logo, small text)

Center (desktop):
  - Main navigation (horizontal)
  - 5-7 top-level items max
  - Hover: underline slide-in animation (2px, brand color, 200ms ease)
  - Active page: underline always visible

Right:
  - "Book a call" (ghost button — secondary)
  - "Get a free audit" or "Get pricing" (filled CTA — primary)
  - Optional: dark mode toggle icon

Mobile:
  - Hamburger (3-line, animates to X on open)
  - Full-screen overlay menu on open
  - All nav items in vertical list
  - CTA buttons at bottom of mobile menu
  - Back button pattern for submenu (not accordion)

Main navigation items (per agency, customizable):
  Services  (has mega menu)
  Tools     (grid of all tools)
  Insights  (blog + playbooks)
  Case Studies / Work
  About
  Pricing

==============================================================
MEGA MENU (SERVICES)
==============================================================
Trigger:     Hover (desktop) / Tap (mobile opens submenu, not mega)
Style:       Full-width dropdown (100vw), max-height: 520px
Background:  --color-surface (solid, no glassmorphism — legibility)
Border:      1px top + bottom border
Shadow:      Large soft shadow (--shadow-xl)
Animation:   Fade + slide down (180ms ease-out)

Layout: 4-column grid
  Column 1-3: Service groups (3-4 services per column)
    - Group label (small caps, --color-text-muted)
    - Service items:
        Name (medium weight, --color-text-primary)
        One-line description (small, --color-text-secondary)
        Arrow icon (appears on hover, slides right 4px)
  Column 4: Featured card (sticky)
    - Current promotion or top service highlight
    - Small illustration or icon
    - CTA button

Footer row of mega menu:
  Left: "See all services →"
  Right: Quick CTA "Not sure? Book a free 30min call →"

Mobile services submenu:
  Full-screen slide-in from right
  Services listed vertically with description
  Back button (top-left) returns to main menu

==============================================================
HOMEPAGE — SECTION-BY-SECTION ANATOMY
==============================================================
Same structure for all 12 agencies. Niche content + imagery differs.

SECTION 1: HERO
  Layout: 60% text left / 40% image right (desktop) | stacked (mobile)
  H1: Primary value proposition (60-80 chars)
  Subhead: Amplifying sentence (100-120 chars)
  Two CTAs: Primary "Get free audit" + Secondary "See our work"
  Social proof bar: "Trusted by X companies" + 3-4 logo thumbnails
  Hero image: Niche-specific AVIF (art-directed mobile/desktop)
  Micro-animation: Subtle floating on image (CSS, 6s infinite, reduced if reduced-motion)
  LCP optimization: Hero image preloaded, fetchpriority="high"

SECTION 2: TRUST BAR (full-width)
  Client logo strip (scrolling marquee, CSS only, no JS)
  Speed: 30s loop, pauses on hover
  Logos: 6-8 real client logos + 2-3 well-known brand logos if applicable
  Label above: "Trusted by growth-stage companies"
  Background: --color-surface-muted

SECTION 3: PROBLEM / PAIN SECTION
  Headline: "The problem with [niche] today" or "Why most [niche] fails"
  3-4 pain point cards:
    Icon (service icon, 48px)
    Pain point title
    2-sentence description
    "Sound familiar?" micro-copy at bottom
  Background: white / --color-surface
  Animation: Cards fade-in staggered on scroll-enter (60ms delay each)

SECTION 4: SOLUTION / WHAT WE DO
  Headline: "How we solve it"
  Subhead: Our methodology or unique approach
  Service grid:
    3-4 primary services (niche-specific)
    Each card:
      Illustration (niche SVG, 120px)
      Service name
      2-sentence outcome-focused description
      "Learn more →" link (no button, just text + arrow)
  Background: --color-surface-muted

SECTION 5: HOW IT WORKS (PROCESS)
  Headline: "Our process" or "How we work"
  4-5 step horizontal timeline (desktop) / vertical (mobile)
  Each step:
    Step number (large, --color-brand-primary/20 background circle)
    Step title
    2-sentence description
    Connector line between steps (desktop)
  Optional: estimated timeline badge on last step ("Results in 8-12 weeks")

SECTION 6: TOOLS / FREE AUDIT CTA
  Headline: "Get your free [niche] audit" or "Try our [tool name]"
  Tool widget embed (smallest tool, quick 3-input version)
  OR Tool result preview (screenshot-style) with CTA to full tool
  CTA: "Get your free audit →" (primary button, large)
  Background: --color-brand-primary (inverted section)
  Text: white on brand color
  Note: This section drives tool leads

SECTION 7: CASE STUDIES / RESULTS
  Headline: "Real results from real companies"
  3 case study cards (playbooks at v1, real at launch):
    Industry badge
    Challenge sentence
    Outcome metric (bold, large — e.g. "47% reduction in CAC")
    Company type (not real name at v1)
    Read more link
  Fallback if no real cases: "Industry playbooks" framing
  Animation: Counter animation on metrics (IntersectionObserver, once)

SECTION 8: TESTIMONIALS
  Headline: "What our clients say"
  3 testimonials (slider on mobile, grid on desktop):
    Quote (2-3 sentences max)
    Author name
    Job title + Company
    Photo (real, with permission)
    Star rating (if applicable)
  Auto-advance: OFF (accessibility — no autoplay)
  Nav: Prev/Next arrows + dot indicators
  Fallback if no real testimonials: section hidden, not shown empty

SECTION 9: WHY US
  Headline: "Why [Agency Name]"
  3-4 differentiator cards:
    Icon (custom, 40px)
    Differentiator name
    2-sentence explanation
  Optional stat bar below: "X projects delivered / Y years / Z in revenue generated"

SECTION 10: PRICING TEASER
  Headline: "Transparent pricing"
  Not full pricing — just pricing philosophy:
    "We don't do retainer-only / per-project quotes / etc."
    "Starting from $X / month" (if applicable)
  CTA: "Get your custom quote →"
  Background: --color-surface-muted

SECTION 11: FAQ PREVIEW
  Headline: "Common questions"
  5-6 most common FAQ items (accordion, one open at a time)
  "See all FAQs →" link to /faq
  FAQ schema auto-applied

SECTION 12: FINAL CTA (full-width)
  Large headline: "Ready to [outcome]?"
  Subhead: Urgency or social proof reinforcement
  2 CTAs: Book call + Contact us
  Background: Dark (--color-gray-900 or brand dark)
  Optional: availability indicator "Currently taking 2 new clients"

SECTION 13: FOOTER
  4-column layout (desktop) / 2-column (mobile) / 1-column (small)
  Column 1: Logo + tagline + social links (LinkedIn, Instagram, Twitter/X)
  Column 2: Services (links to all service pages)
  Column 3: Company (About, Blog, Case Studies, Careers)
  Column 4: Contact (Email, Phone, Address, Book a call link)
  Bottom bar: Copyright + Privacy + Terms + Cookie settings

==============================================================
SERVICE PAGE ANATOMY (/services/[slug])
==============================================================
URL: /services/[niche-specific-service-name]
Schema: Service + FAQPage

SECTION 1: HERO
  H1: Service name + primary keyword
  Subhead: Who it's for + primary outcome
  CTA: "Get started" + "See how it works"
  Trust element: "X clients served this year" or specific stat
  Hero image: Service-relevant (process shot or abstract)

SECTION 2: WHO IT'S FOR
  Headline: "Is this for you?"
  Checklist of 5-7 ideal client characteristics:
    ✓ You're a [company type]
    ✓ You're struggling with [specific pain]
    ✓ You've tried [old solution] and it didn't work
  Note: "If this sounds like you, you're in the right place."

SECTION 3: THE PROBLEM
  Deep dive into the pain (this is the key SEO + conversion section)
  Tell the story of the problem in 3-4 paragraphs
  Use specific language, numbers, industry examples
  No generic "many companies struggle with..."

SECTION 4: COST OF INACTION
  What happens if they don't solve this?
  Specific outcomes: revenue lost, time wasted, competitors winning
  NOT fear-mongering — factual, sourced if possible

SECTION 5: OUR SOLUTION
  What we do specifically
  Not just "we do X" — how we do it, methodology
  3-step or 4-step process visual
  What makes our approach different from competitors

SECTION 6: DELIVERABLES / WHAT YOU GET
  Clear deliverable list (checklist style):
    Deliverable name + brief explanation
    Timeline for each (e.g. "Week 1-2")
    Format (report, workshop, implemented, ongoing)
  Optional: sample output preview (blurred/anonymized)

SECTION 7: TOOL OR DIAGNOSTIC
  Embed the most relevant tool for this service
  "Start with a free audit" framing
  Short version (3-4 inputs), links to full tool

SECTION 8: RESULTS / CASE STUDY PREVIEW
  2-3 relevant case study cards (same as homepage)
  Niche + outcome focused
  At v1: playbook framing

SECTION 9: PRICING
  One of:
    A. Tiered pricing table (3 tiers: Starter / Growth / Scale)
    B. "Starting from $X/month" with "Get custom quote" CTA
    C. "Fixed project pricing from $X" with scope outline
  No fake "Contact us for pricing" without any anchor — always give range

SECTION 10: PROCESS TIMELINE
  "What happens after you reach out"
  4-step process: Intro call → Proposal → Kickoff → Delivery
  Estimated timelines at each step

SECTION 11: FAQ (SERVICE-SPECIFIC)
  8-10 FAQ items specific to this service
  Answers must be substantive (100+ words each)
  FAQ schema applied

SECTION 12: FINAL CTA
  "Ready to [outcome of this service]?"
  Primary button: Book a free consultation
  Secondary: Download our service overview (optional PDF)

==============================================================
BLOG POST LAYOUT (/blog/[slug])
==============================================================
Two-column layout: Main article (70%) + Sidebar (30%)

ARTICLE COLUMN:
  Breadcrumb: Home > Blog > [Category] > [Post Title]
  Featured image (16:9, full-width of article column)
  Category badge + Read time + Published date
  H1 (post title, large)
  Author byline: Photo + Name + Title + Date
  AIO TL;DR box (styled callout, prominent)
  Body content (Lexical rendered blocks)
  FAQ section (if applicable, FAQ schema)
  Author bio card (full) at bottom
  Tags (clickable, filtered blog list)
  Share buttons (Twitter/X, LinkedIn, Copy link)
  Related posts (3 cards, same category)
  Closing CTA (service relevant to post topic)

SIDEBAR (sticky on desktop, below article on mobile):
  Search bar (searches blog only)
  Categories (all, with count)
  Table of contents (scroll-spy, highlights current section)
  Newsletter CTA (compact: email field + subscribe)
  Popular posts (3-5, by views)
  Tool CTA (most relevant tool to post topic)

Blog list page (/blog):
  Header: "Insights & Playbooks" + subtitle
  Filter bar: All / [Category 1] / [Category 2] / etc.
  Grid: 3-column desktop / 2-column tablet / 1-column mobile
  Each card: Featured image / Category / Title / Excerpt / Read time / Date
  Pagination: "Load more" button (not numbered pages)
  No infinite scroll (Core Web Vitals risk)

==============================================================
FAQ PAGE (/faq)
==============================================================
Header: "Frequently Asked Questions"
Subhead: Short intro + link to contact
Category tabs or anchor links (General / Services / Pricing / Process / etc.)
Accordion list per category (all closed by default, one opens at a time)
Each item:
  Question (trigger, full-width clickable)
  Answer (expanded, 100-250 words recommended)
  Internal link within answer (whenever relevant)
Schema: FAQPage with all items
CTA at bottom: "Still have questions? Book a 15min call"

==============================================================
ABOUT PAGE (/about)
==============================================================
SECTION 1: INTRO
  Headline: "We're [Agency Name]" or "About [Agency Name]"
  Subhead: Mission statement (1-2 sentences)
  Founder quote (brief, authentic)

SECTION 2: STORY
  Narrative of why the agency was founded
  What problem the founder saw in the market
  When founded, key milestones
  Text + founder photo side-by-side

SECTION 3: WHAT WE BELIEVE (VALUES)
  3-4 core values
  Each: icon + name + 2-sentence explanation
  Not generic ("We care about quality") — specific and authentic

SECTION 4: TEAM
  Team grid (2-4 people at v1, real photos required)
  Each card:
    Photo (portrait, niche style)
    Name
    Title
    LinkedIn link (optional)
    1-sentence bio
  If team not photographed yet: section hidden (not placeholder)

SECTION 5: PROCESS / HOW WE WORK
  Same as homepage process section, but more detailed
  4-6 steps with longer descriptions

SECTION 6: BY THE NUMBERS
  3-5 stats (real, sourced, or conservative estimates):
    Projects completed
    Years in [niche]
    Client retention rate
    Revenue generated for clients (range, sourced)
  Note: use ranges and estimates, never fabricate

SECTION 7: CLIENT LOGOS
  Same as trust bar from homepage, larger version

SECTION 8: CTA
  "Let's work together →"
  Book a call button

==============================================================
CONTACT PAGE (/contact)
==============================================================
Two-column: Form (60%) / Info (40%)

LEFT - Contact form:
  Name (required)
  Email (required)
  Phone (optional)
  Company (optional)
  Service interest (dropdown: all services)
  Message (textarea)
  "How did you hear about us?" (dropdown)
  Consent checkbox (TCPA, unchecked default)
  Submit CTA: "Send message" (not "Submit")
  Confirmation: inline message (not redirect) — "We'll be in touch within 4 hours."

RIGHT - Contact info:
  Email address (clickable)
  Phone (clickable, US format)
  Address (if applicable)
  Business hours (timezone specified)
  Calendly/Cal.com embed OR link to /book
  Response time promise: "We respond within 4 business hours"
  Social links

Below fold: Google Maps embed (if physical office)

==============================================================
PRICING PAGE (/pricing)
==============================================================
Header: "Transparent pricing for [niche] services"
Subhead: Philosophy statement

Pricing model options (admin picks one per agency):
  Option A: Tiered plans table
    3 tiers: Starter / Growth / Scale
    Features comparison table (checkmarks)
    Price per tier (monthly, with annual toggle saving ~20%)
    "Most popular" badge on middle tier
    CTA per tier

  Option B: Project-based pricing
    "Projects start from $X"
    Service categories with ranges:
      [Service 1]: $X,XXX - $XX,XXX
      [Service 2]: $X,XXX - $XX,XXX
    CTA: "Get your custom quote"

  Option C: Retainer-only
    Monthly retainer starting from $X
    What's included in retainer
    Scope examples
    CTA: "Book intro call to discuss"

FAQ below pricing: 5 billing/payment questions
Trust elements: "No hidden fees" / "Money-back guarantee if applicable" / "Contracts flexible"

==============================================================
TOOLS LIST PAGE (/tools)
==============================================================
Header: "Free [Niche] Tools & Calculators"
Subhead: "Get instant insights with our free tools"

Tool cards (3 per agency = 3 cards):
  Tool icon (custom per tool)
  Tool name
  One-sentence description
  "Takes 2 minutes" time badge
  "Start free →" CTA
  Sample result (blurred screenshot as social proof)

Below cards: Why these tools?
  Value prop for using tools before hiring
  "Get your benchmark before your first call"

Email capture (optional): "Get all 3 tool reports in one PDF"

==============================================================
ADVANCED UI FUNCTIONALITY
==============================================================
Scroll animations:
  Library: CSS custom properties + IntersectionObserver (no JS library)
  Pattern: opacity 0 -> 1, translateY 16px -> 0, duration 400ms
  Trigger: element 80% in viewport
  Stagger: 60ms delay for sibling elements
  Reduced motion: skip all (prefers-reduced-motion: reduce)
  Never animate LCP element (CLS risk)

Sticky elements:
  Header: sticky with scroll-behavior (slide down on up-scroll)
  Sidebar TOC: sticky within article column
  Puck admin bar: always fixed top (z-index 9999)
  CTA button: floating CTA at bottom-right on mobile (scrolled 50%)

Page transitions:
  View Transitions API (Next.js 15 experimental)
  Fallback: instant for prefers-reduced-motion
  Pattern: fade (200ms) — nothing complex

Counter animations:
  Stats sections: count up from 0 on viewport enter
  Library: custom useCountUp hook (IntersectionObserver-based)
  Easing: ease-out cubic
  Duration: 1.5 seconds
  Only fires once (not on re-enter)

Accordion / FAQ:
  CSS-only expand (max-height: 0 -> max-height: 500px, transition 300ms)
  No JS required for open/close
  ARIA: aria-expanded, aria-controls on trigger
  One open at a time (JS manages, progressive enhancement)

Logo marquee (trust bar):
  Pure CSS animation (no JS)
  animation: marquee 30s linear infinite
  Pauses on hover (animation-play-state: paused)
  Duplicate set (for seamless loop)
  Reduced motion: static, no scroll

Dark mode toggle:
  Stored in localStorage + system preference fallback
  Token swap only (CSS variable update on :root)
  No flash on page load (inline script in <head>)
  Icon: sun/moon, animated rotate on switch

Mega menu behavior:
  Keyboard: Tab into menu, arrow keys navigate items, Escape closes
  Touch: tap opens, tap outside closes
  Hover delay: 150ms before open (prevent accidental trigger)
  Close delay: 300ms after mouseout (allow moving to submenu)

Search:
  Blog search: Meilisearch instant search (results as you type)
  Keyboard: Cmd+K opens global search modal (admin only)
  Results: highlighted matching terms in result titles

Form UX:
  Inline validation (on blur, not on submit)
  Error messages: below field, specific and human
  Success: inline message (not redirect), confetti animation (subtle)
  Progress: show step indicator on multi-step forms
  Autofill: supports browser autofill on all fields
  Phone formatting: auto-formats as user types (US format)

Image loading:
  All images: BlurHash background before load
  Dominant color: CSS background fallback if BlurHash fails
  Fade in: 200ms opacity transition on load
  Error: niche illustration fallback if image 404s

Chatbot widget:
  Floating button (bottom-right, above floating CTA)
  Opens overlay (not inline)
  Smooth slide-up animation (300ms)
  Not shown on mobile when keyboard open (resize event)
  Closed by default

Cookie banner:
  Minimal bar at bottom (not full-page overlay)
  "Accept all" + "Manage preferences" only
  Disappears immediately on accept (no delay)
  Re-shows: only if preference cleared

Video embeds:
  Facade pattern (lite-youtube-embed)
  Poster: AVIF thumbnail, loaded eagerly
  Play button: accessible (aria-label="Play [video title]")
  Load iframe: only on play click
  Saves ~600KB JS on initial load

Table of contents (blog sidebar):
  Auto-generated from H2 + H3 elements
  Scroll-spy: highlights current section (IntersectionObserver)
  Click: smooth scroll to section
  Collapse: H3 items hidden, expand on H2 click

==============================================================
AGENCY-SPECIFIC UI DIFFERENTIATION
==============================================================
Each agency has a distinct visual identity. Not just color change.

main (brand.com):
  Design style:    Clean, grid-based, authoritative
  Typography:      Serif display + sans-serif body (e.g. Playfair Display + Inter)
  Colors:          Neutral warm (#1a1a1a + #f5f0eb + one accent)
  Illustrations:   Abstract architectural
  Photography:     Lifestyle + office
  Hero treatment:  Split hero, text-heavy
  Unique elements: Agency portfolio grid showing all 11 subagencies

ecommerce.brand.com:
  Design style:    Bold, product-forward, high energy
  Typography:      Heavy sans-serif display (e.g. Syne ExtraBold + DM Sans)
  Colors:          Deep navy + electric orange or teal accent
  Illustrations:   Product-centric, shopping cart, conversion funnel
  Hero treatment:  Full-width image + overlay text + metric callouts
  Unique elements: Revenue calculator prominent in hero

growth.brand.com:
  Design style:    Data-forward, SaaS-aesthetic, indigo/violet
  Typography:      Geometric sans (e.g. Manrope + Inter)
  Colors:          Indigo #4F46E5 + violet gradient + white
  Illustrations:   Charts, funnels, pipeline stages
  Hero treatment:  Dashboard mockup screenshot + gradient bg
  Unique elements: Live "growth metrics" animated counter section

webdev.brand.com:
  Design style:    Technical, clean, code-aesthetic
  Typography:      Monospace for accents (code snippets), clean sans for body
  Colors:          Cool slate + cyan accent
  Illustrations:   Code windows, UI components, device mockups
  Hero treatment:  Terminal/code animation in hero (CSS only, not real terminal)
  Unique elements: Tech stack badges section

ai.brand.com:
  Design style:    Futuristic, soft, violet-warm
  Typography:      Modern thin sans + slightly increased line height
  Colors:          Deep violet #3B1FA8 + soft cream + electric accent
  Illustrations:   Network nodes, AI brain, data flows
  Hero treatment:  Particle animation background (CSS, lightweight)
  Unique elements: AI capability showcase (animated feature cards)

branding.brand.com:
  Design style:    Editorial, bold, cinematic
  Typography:      Condensed serif display + elegant sans
  Colors:          Black + warm cream + single bold accent
  Illustrations:   Brand identity elements, type specimens
  Hero treatment:  Full-bleed photography, minimal text overlay
  Unique elements: Before/after brand transformation showcase

strategy.brand.com:
  Design style:    Corporate refined, authoritative, structured
  Typography:      Classic serif + clean sans
  Colors:          Deep navy + gold + white
  Illustrations:   Strategy maps, org charts, decision trees
  Hero treatment:  Split hero with framework diagram
  Unique elements: Strategic framework visual (proprietary-looking)

finance.brand.com:
  Design style:    Trust-first, clean, professional
  Typography:      Conservative serif + legible sans
  Colors:          Deep navy + muted green + light gray
  Illustrations:   Financial charts, tax documents, spreadsheets
  Hero treatment:  Clean with credibility badges prominent
  Unique elements: Tax savings calculator in hero section

engineering.brand.com:
  Design style:    Precise, technical, industrial
  Typography:      Technical sans + monospace accents
  Colors:          Charcoal #2D2D2D + amber #F59E0B + white
  Illustrations:   Blueprints, circuit diagrams, architecture diagrams
  Hero treatment:  Split with technical diagram or spec sheet aesthetic
  Unique elements: Technology stack visualization

product.brand.com:
  Design style:    Human-centered, warm, IDEO-adjacent
  Typography:      Rounded humanist sans
  Colors:          Warm cream + coral + deep green
  Illustrations:   Sketches, wireframes, research sticky notes
  Hero treatment:  Full-width with process imagery
  Unique elements: Design thinking process visual + portfolio grid

video.brand.com:
  Design style:    Cinematic, high-contrast, bold
  Typography:      Wide tracking display + clean body
  Colors:          Near-black + electric yellow or coral accent
  Illustrations:   Camera, film reel, timeline elements
  Hero treatment:  Full-bleed video loop (muted, <2MB, 8s)
  Unique elements: Video reel autoplay (muted, facade until user interaction)

graphic.brand.com:
  Design style:    Creative, typographic, bold layouts
  Typography:      Expressive display + highly legible body
  Colors:          Bold contrast — varies by season/campaign (admin-controlled)
  Illustrations:   Type specimens, color swatches, design tools
  Hero treatment:  Oversized type + graphic element collage
  Unique elements: Portfolio masonry grid (first section after hero)

==============================================================
BLOG CATEGORY PAGE (/blog/[category])
==============================================================
Header: "[Category Name]" + short description of category
Breadcrumb: Home > Blog > [Category]
Post grid: Same as main blog list
Sidebar: Same as blog list (no TOC on list page)

==============================================================
AUTHOR PAGE (/blog/authors/[slug])
==============================================================
Author photo (large, portrait)
Name + Title + Company
Bio (300-500 words, real person)
Social links (LinkedIn primary)
All posts by this author (grid, same as blog list)
Schema: Person with sameAs

==============================================================
LEGAL PAGES (/privacy-policy, /terms-of-service, /cookie-policy)
==============================================================
Layout: Single column, max-width 800px, left-aligned
No sidebar
Table of contents at top (anchor links)
Last updated date (prominent, above H1)
Simple typography, high contrast
All content: AI-drafted from US-standard template + niche clauses

==============================================================
404 PAGE
==============================================================
Headline: Friendly, branded (not "404 Error")
  Examples: "Lost in [niche]?" / "This page took a wrong turn"
Illustration: Niche-specific (confused robot / lost map / etc.)
Helpful links: 3-4 most important pages
Search bar: Blog search
CTA: "Go back home" + "Contact us"

==============================================================
500 PAGE
==============================================================
Headline: "Something went wrong on our end"
Subhead: "Our team has been notified. Try refreshing in a moment."
No illustration (keep it fast)
"Go home" button
Contact info (in case issue persists)

==============================================================
PAGE SPEED GUARDRAILS (BAKED INTO EVERY UI DECISION)
==============================================================
Fonts: max 2 font families, preloaded, variable preferred
Images: AVIF primary, width+height always, lazy below fold
Scripts: defer all, async where possible, no render-blocking
CSS: Tailwind purged, no unused utilities shipped
Animations: CSS only, no GSAP or heavy libraries
Icons: Sprite (single HTTP request) or inline SVG (for above-fold icons)
Third-party: Facade pattern for all embeds (video, maps, chat)
Fonts: font-display: optional for H1 font, swap for body
BlurHash: all images have placeholder, no layout shift
LCP: hero image preloaded with imagesrcset + imagesizes

CI gates (all P0 pages, all 12 agencies):
  LCP: fail if >2.5s
  CLS: fail if >0.1
  INP: fail if >500ms
  Lighthouse performance: fail if <85

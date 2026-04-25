specs/content.md - MJAgency Content Strategy Spec

==============================================================
CONTENT-COMPLETE RULE (TOP PRIORITY)
==============================================================
ALL content authored DURING build phases. NOT post-launch.
Every page, every agency, every image slot = 100% complete.
ONLY Brand Setup Wizard remains for user after generation.
Zero TODO. Zero placeholder. Zero "Coming soon".

Content sprint: parallel GSD-2 workstream alongside engineering.
Starts: after M005 cms-collections slice completes (HARD DEPENDENCY).
Runs: parallel to M006-M011.
Uses: LiteLLM (Flash-Lite for content, Sonnet for complex pages).
Writes to: Payload CMS REST API (never direct DB).

==============================================================
V1 MINIMUM CONTENT PER AGENCY (ALL 12)
==============================================================
Pages (must exist before launch):
  Home page
  About page
  Services hub
  3-5 service detail pages
  1+ industry insight/playbook page
  1+ tool with full content (2200+ words)
  Pricing / get a quote page
  Contact page
  FAQ page (10+ entries)
  3+ cornerstone blog posts
  Privacy policy
  Terms of service
  Cookie policy
  404 page
  500 page

Media (must be complete):
  3-5 team/founder photos (REAL, not stock/AI)
  1 office or workspace photo (REAL)
  6+ real client logos (with permission)
  3+ testimonials (with permission)
  30 niche illustrations
  Hero images for all P0 pages
  All service icon sets (6-10 per agency)
  All process icon sets (4-6 per agency)

CRM data (pre-seeded):
  Full pipeline with niche overrides
  30 tags, 10 custom fields
  10+ email templates
  8 email sequences
  5 SMS templates
  6 meeting types (Cal.com)
  2 proposal templates
  1 pitch deck template

Tool content:
  3 tools per agency = 36 total
  Each tool: full page 2200+ words
  Each tool: real benchmark dataset loaded
  Each tool: result copy (3 score bands)
  Each tool: email sequence post-capture

==============================================================
WORD COUNT FLOORS (VALIDATOR ENFORCED)
==============================================================
Home page:          800 min / 1500 recommended
About page:         1000 min / 2000 recommended
Services hub:       800 min / 1500 recommended
Service detail:     1500 min / 2500 recommended
Sub-niche/use-case: 800 min / 1200 recommended
Industry detail:    1000 min / 1500 recommended
Location/state:     600 min / 1000 recommended
Case study/playbook: 1500 min / 3000 recommended
Tool page:          2200 min (HARD MINIMUM)
Pricing page:       500 min / 800 recommended
Blog post:          1500 min / 2500 recommended
Cornerstone blog:   3000 min / 5000 recommended
Glossary term:      200 min / 400 recommended
FAQ entry:          100 min / 250 recommended
Author bio:         300 min / 500 recommended
Contact page:       300 min / 600 recommended
Legal page:         1500 min / 3000 recommended
404 page:           100 min

==============================================================
SEO / AIO / GEO STANDARDS (ALL PAGES)
==============================================================
Every indexable page must have:
  H1 (matches primary keyword intent)
  Meta title (<=60 chars, keyword in title)
  Meta description (<=160 chars)
  AIO TL;DR (<=120 chars, answers query directly)
  Canonical URL (self-referencing)
  Last reviewed date (visible + in Article schema)
  Author + Person schema (on long-form)
  >= 3 internal links
  >= 1 external citation per major claim
  Alt text on every image (>=10 chars, meaningful)
  FAQ schema on FAQ-eligible pages (3+ questions)
  Heading structure: logical H1->H2->H3 (no skips)
  Open Graph tags (auto-generated)

Schema types (auto-generated per page type):
  Home:         Organization + WebSite
  About:        Organization + Person (author)
  Service:      Service + FAQPage
  Blog post:    Article + Person (author) + FAQPage
  Tool page:    SoftwareApplication + HowTo + FAQPage
  Case study:   Article (never CaseStudy schema - reduces fake review risk)
  Playbook:     Article (not CaseStudy, not Review)
  Author bio:   Person
  FAQ:          FAQPage
  Pricing:      PriceSpecification

AIO optimization (per page):
  Direct answer format: H2 = question, answer in first paragraph
  Citation-friendly chunks: H2/H3 every 300 words
  Stat highlighting: numbers in bold, sourced
  Quote-friendly sentences: <=25 words average
  Comparison tables when relevant (machine-readable)
  llms.txt: per agency, tool-listed with descriptions

GEO optimization:
  geo-chunking plugin: configures content for AI search engines
  Structured entity linking: first mention linked to entity page
  Confidence signals: every claim sourced, dated, attributed

==============================================================
CONTENT QUALITY DIMENSIONS
==============================================================
Originality:         <70% similarity to known web content
Reading level:       Flesch-Kincaid grade 8-12 (B2B)
Keyword density:     0.5-2% primary keyword
LSI entities:        >=10 related terms per article
AI content ratio:    Calculated per field (ai_word_count / total_word_count)
                     Page ratio = sum of all fields
                     Disclosure at >70% page ratio
Stat sourcing:       Every stat has external citation + date
Quote attribution:   Every quote has source + link
Internal links:      >=3 per article, >=5 for cornerstone
External links:      >=1 per major claim (authoritative sources)

==============================================================
AI CONTENT POLICY
==============================================================
AI ships direct (no approval needed):
  Body copy (service, industry, blog, glossary)
  Meta titles + descriptions
  AIO TL;DR
  FAQ extraction and writing
  Product + service descriptions
  Playbook / industry insight copy
  Form field labels, tooltips, confirmation copy
  Email templates + sequences
  Legal pages (US-standard template + niche clauses)
  Tool page content (how it works, benchmarks context, use cases)
  Booking meeting descriptions
  Proposal copy

AI banned regardless:
  Author bios (must be real person, real credentials)
  Real client testimonials (FTC fraud)
  Exact client case studies with client name (without permission)
  Real benchmark numbers (must source from real published data)
  Stats without citation (stat detector blocks)

AI content disclosure:
  Auto-attached as metadata when page ratio >70% AI
  Footer line: "Some content on this page was generated with AI assistance"
  Required in page schema (additionalType: "AI-Assisted")
  Cannot be removed manually

==============================================================
ANTI-SPAM GUARDS
==============================================================
Keyword stuffing:         Density validator, 0.5-2% range
Doorway pages:            Programmatic uniqueness gate (>=1 unique block)
Scaled content abuse:     Originality validator blocks if >70% similar to web
Duplicate content:        Embeddings similarity check, blocks if >85% match
Cannibalization:          Embeddings + intent classifier, super_admin reviews
Soft-404:                 Coverage score, auto-flagged for review
Thin content:             Word count floor enforced at publish
AI disclosure:            Auto-attached when >70% AI, visible
Placeholder text:         Linter blocks lorem, TODO, [insert], Coming soon

==============================================================
CASE STUDY vs PLAYBOOK RULES
==============================================================
Playbook (AI-generated, no real client needed):
  - Format: "How agencies in [niche] solve [problem]"
  - No specific company names, named executives
  - Numbers: RANGES only (e.g. "30-45%", not "37%")
  - Disclaimer required (FTC 2023):
    "Results depicted are composite examples based on typical outcomes
    for clients in this industry. Individual results vary. These are not
    testimonials from specific clients. Learn more about our methodology."
  - Schema: Article (not CaseStudy, not Review)
  - URL pattern: /insights/<topic> or /playbooks/<topic>
  - noindex: false (indexable)

Real case study (requires client permission):
  Toggle is_composite_playbook = false to convert
  On toggle:
    - noindex removed
    - Client name field unlocked (required)
    - Client logo required
    - Testimonial required
    - Schema changes Article -> unlocks rich case study markup
    - Disclaimer footer removed
    - URL stays same (no redirect)
  Permission vault: client permission file required before publish

==============================================================
TOOL PAGE CONTENT STRUCTURE (2200+ WORDS)
==============================================================
Hero (100 words):
  Tool name, "Free tool" badge, value prop, estimated time

How it works (400+ words):
  Methodology explanation, formula logic
  What each input means, why it matters
  How calculation is performed

Benchmark context (300+ words):
  Industry scores overview, sourced from real studies
  What the benchmarks measure, why they matter
  Source citations with dates

Result interpretation guide (300+ words):
  Low score meaning + what to do
  Mid score meaning + what to do
  High score meaning + what to do

Use cases (300+ words):
  3-5 real scenarios where tool applies
  Niche-specific examples

Common mistakes (200+ words):
  What inputs people get wrong
  How to get accurate results

FAQ (600+ words = 6 questions x 100 words each):
  Common questions about the tool
  FAQ schema auto-applied

Related tools: 2-3 internal links
Related service: link to relevant service page
Author + methodology disclosure
Benchmark source citations (linked, dated)
Disclaimer: "Estimates based on industry benchmarks. Results vary."

==============================================================
CONTENT AUDIT DASHBOARD (PHASE 11)
==============================================================
Per page, per agency:
  Coverage % (all required slots filled)
  Word count distribution
  Last reviewed dates (stale flagged at 12 months)
  Originality scores
  AI ratio (disclosure compliance)
  Internal link density
  AIO TL;DR coverage %
  FAQ schema coverage %
  Cannibalization warnings
  Soft-404 candidates
  Refresh queue

Quarterly automated audit:
  Metadata completeness
  Permission validity
  Brand drift check
  Orphan asset cleanup
  Stale content identification

==============================================================
NICHE CONTENT STRATEGY (PER AGENCY)
==============================================================
Each agency's content targets a specific ICP (Ideal Client Profile).
Content must reflect niche language, pain points, and outcomes.

main (multi-agency brand):
  ICP: founders who need multiple agency services
  Pain: managing multiple vendors, inconsistent quality
  Outcome: one trusted partner, cohesive results

ecommerce:
  ICP: DTC brands $1M-$20M ARR, Shopify/WooCommerce
  Pain: high CAC, low retention, cart abandonment, thin margins
  Keywords: ecommerce revenue optimization, cart abandonment recovery, DTC growth

growth:
  ICP: B2B SaaS $500K-$5M ARR, Series A-B
  Pain: long sales cycles, poor MQL-to-SQL, CAC too high
  Keywords: B2B growth marketing, SaaS lead generation, demand gen

webdev:
  ICP: companies needing custom web apps, agencies, startups
  Pain: bad estimates, missed deadlines, tech debt
  Keywords: web application development, Next.js agency, custom software

ai:
  ICP: mid-market companies wanting AI but don't know where to start
  Pain: AI hype vs practical ROI, internal capability gaps
  Keywords: AI implementation, business automation, AI consulting

branding:
  ICP: companies rebranding or launching new product lines
  Pain: inconsistent brand, commoditized perception
  Keywords: brand strategy, visual identity, brand positioning

strategy:
  ICP: growth-stage companies $5M-$50M revenue
  Pain: unclear priorities, execution gaps, board pressure
  Keywords: business strategy consulting, growth strategy, OKR consulting

finance:
  ICP: SMBs and startups needing fractional CFO or tax strategy
  Pain: cash flow, tax exposure, fundraising readiness
  Keywords: fractional CFO, tax strategy, financial planning small business

engineering:
  ICP: companies with large technical projects or tech debt
  Pain: hiring engineers, managing complexity, compliance
  Keywords: engineering consulting, technical advisory, software architecture

product:
  ICP: companies building physical or digital products
  Pain: unclear product-market fit, slow iteration, bad UX
  Keywords: product strategy, UX research, product management consulting

video:
  ICP: brands needing video content for marketing or training
  Pain: production cost, turnaround time, brand consistency
  Keywords: video production agency, brand video, explainer video

graphic:
  ICP: companies needing ongoing design output
  Pain: inconsistent design quality, slow turnaround, brand drift
  Keywords: graphic design agency, brand assets, design on demand

==============================================================
CONTENT LOCALIZATION STRATEGY (V1 - US ONLY)
==============================================================
v1: English only, US market only
  - All copy: American English spelling
  - Currency: USD ($)
  - Timezone: displayed in ET/CT/MT/PT with agency location
  - Phone format: (555) 555-5555 or 555-555-5555
  - Date format: MM/DD/YYYY or Month Day, Year
  - Address format: US standard (Street, City, State ZIP)
  - Regulatory: CCPA, FTC, TCPA, ESIGN Act (all US)

v2 expansion possible:
  - UK English + GDPR
  - Canadian French
  Schema structure already supports: locale field on pages/posts

==============================================================
CONTENT REFRESH SCHEDULE (POST-LAUNCH)
==============================================================
Auto-detected stale content:
  last_reviewed_at older than 12 months -> flagged in content audit dashboard
  Benchmark data older than 12 months -> tool warning banner
  Statistics without recency date -> flagged

Recommended manual review schedule:
  Blog posts: every 12 months
  Service pages: every 6 months (pricing/market changes fast)
  Tool pages: every 12 months (benchmark refresh)
  Legal pages: annually + on law changes
  FAQ pages: quarterly (match support questions)
  About page: on team/milestone changes

Automated refresh triggers:
  Algorithm change detected (M006 watcher) -> relevant pages flagged
  Competitor adds new service -> flag matching service pages
  Tool benchmark expires -> flag tool page

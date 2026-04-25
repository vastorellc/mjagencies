specs/tools.md - MJAgency Tools Catalog Spec

==============================================================
TOOL SYSTEM OVERVIEW
==============================================================
36 tools total (3 per agency x 12 agencies)
All tools shipped complete at launch (content-complete rule)
Plugin architecture: config row + calculation module + benchmark dataset + result template

Quality gate (every tool must pass):
  Real benchmark source (published, dated, <=12 months old)
  Deterministic math (same input = same output always)
  Result renders in <2 seconds
  Branded PDF (agency logo, colors, methodology, CTA)
  CRM hook (email capture -> contact created -> sequence enrolled)
  Embeddable via <script> snippet on external sites
  Transparent scoring (user sees how score calculated)
  Compliant disclaimer on results
  Mobile: full feature parity
  Tool page: 2200+ words, full SEO/AIO content

==============================================================
36 TOOLS (3 PER AGENCY)
==============================================================
main:        Agency Readiness Score | Platform ROI Calculator | Market Gap Finder
ecommerce:   Ecommerce Revenue Audit | Cart Abandonment Cost Calculator | Conversion Rate Benchmarker
growth:      Growth Velocity Calculator | MQL-to-SQL Conversion Analyzer | CAC Payback Estimator
webdev:      Website Performance Grader | Tech Stack Cost Calculator | Dev ROI Estimator
ai:          AI Readiness Score | Automation ROI Calculator | AI Cost vs Build Estimator
branding:    Brand Consistency Audit | Rebranding ROI Calculator | Visual Identity Scorer
strategy:    Strategic Gap Analyzer | Decision Speed Calculator | OKR Health Checker
finance:     Cash Flow Health Score | Tax Savings Estimator | Financial Runway Calculator
engineering: Project Scope Estimator | Technical Debt Calculator | Build vs Buy Analyzer
product:     Product-Market Fit Score | Feature Prioritization Matrix | Roadmap ROI Estimator
video:       Video ROI Calculator | Content Production Cost Estimator | Video Performance Benchmarker
graphic:     Design ROI Calculator | Brand Asset Audit | Creative Output Benchmarker

==============================================================
BENCHMARK DATA SOURCES (PER NICHE)
==============================================================
ecommerce:   Shopify Commerce Trends, Baymard Institute, Klaviyo Benchmarks
growth:      OpenView SaaS Benchmarks, Insight Partners, SaaStr data
webdev:      HTTP Archive, Web Almanac, Stack Overflow Survey
ai:          McKinsey AI Report, Gartner, MIT Sloan AI studies
branding:    Nielsen Brand Resonance, Lucidpress, Marq reports
strategy:    McKinsey, BCG, Bain annual strategy reports
finance:     IRS SOI data, AICPA, Deloitte CFO survey
engineering: CHAOS Report, DORA DevOps Report, Accelerate book
product:     Pendo Product Report, Amplitude, ProductPlan survey
video:       Wyzowl Video Marketing Report, Vidyard Benchmarks
graphic:     Adobe Creative Trends, AIGA design value report

All benchmarks:
  - Real published source (link included in tool methodology)
  - Date of data included
  - Expiry flag at 12 months
  - Validator blocks publish if expired
  - Tool shows warning banner if benchmark nearing expiry (30d)

Tool benchmark expiry behavior:
  - Tool remains live
  - Results still show
  - Yellow warning banner: "Benchmarks last updated [date]. Update in progress."
  - AI accuracy badge removed until refreshed
  - Super_admin gets expiry alert 30 days out
  - Admin gets alert 14 days out

==============================================================
TOOL PAGE ANATOMY (PER TOOL, FULL CONTENT)
==============================================================
Hero section:
  Tool name + "Free tool" badge
  Value prop (what you get, estimated time)
  Primary keyword in H1

AIO TL;DR (<=120 chars, required)

Interactive tool widget:
  3-8 input fields, progressive, mobile-first
  Instant result render (no page reload)
  Score breakdown (how each input contributed)
  Benchmark comparison ("your score vs industry avg")
  AI insights panel (3 insights, Flash-Lite generated at result time)
  Next steps (2-3 recommendations per score band)
  PDF capture gate: "Get full report" -> email -> PDF delivered + CRM hook

How it works section (400+ words):
  Methodology, formula logic, input explanations

Benchmark context section (300+ words):
  Industry scores, sources cited, dated

Result interpretation (300+ words):
  Low/mid/high score meaning + actions

Use cases section (300+ words):
  3-5 niche-specific scenarios

Common mistakes section (200+ words):
  How to get accurate results

FAQ section (600+ words = 6+ questions x 100+ words each):
  FAQ schema auto-applied

Related tools (2-3 internal links)
Related service (link to relevant service page)
CTA (book call / get proposal / contact)
Author + methodology disclosure
Benchmark citations (linked, dated)
Disclaimer: "Estimates based on industry benchmarks. Individual results vary."

SEO:
  Meta title: "[Tool Name] — Free [Niche] [Tool Type] | [Agency Name]"
  Meta description: <=160 chars, primary keyword, benefit-led
  Primary keyword: "[niche] [tool type] calculator/grader/analyzer/score"
  Internal links: >=3
  External citation: >=1
  Schema: SoftwareApplication + HowTo + FAQPage

==============================================================
CRM INTEGRATION
==============================================================
On tool started:         Anonymous session tracked
On tool completed:       Result rendered, session stored
On PDF requested:        Email captured -> contact created/updated -> result logged
On sequence enrolled:    Niche tool-result sequence (5 emails, 14 days) based on score
On low score (<25):      "How we fix this" CTA prominent -> service page -> book call
On high score (>75):     "You're ready for X" CTA -> next tool or proposal
On score >60:            Hot lead flag -> 4h follow-up task -> owner notification

==============================================================
TOOL RESULT URLS
==============================================================
Result pages: NOT separate indexable URLs.
Results render inline on tool page (no unique result URL).
Share feature: signed link to result state (expires 30 days).
Shared result pages: noindex.
Zero duplicate content risk from tool results.

==============================================================
PRE-SEEDED CONTENT (ALL 36 TOOLS AT BUILD)
==============================================================
Per tool:
  Tool headline + subhead (AI-drafted, keyword-led)
  AIO TL;DR
  Full 2200+ word page (all sections above)
  Input field labels + tooltips
  Result copy (low/mid/high bands)
  AI insights templates (generated at result time by Flash-Lite)
  PDF template (branded, methodology + result + next steps)
  Email capture sequence (5 emails, AI-drafted, per niche)
  Meta title + description
  Benchmark dataset loaded from real sources
  Internal links mapped
  External benchmark citations included
  Disclaimer text
  FAQ entries (6+)
  Schema markup

==============================================================
TOOL EMBED IMPLEMENTATION
==============================================================
Each tool embeddable on external sites:
  <script src="https://agency.brand.com/embed/tool/<slug>.js"></script>
  <div data-mjagency-tool="<slug>"></div>

Embed script behavior:
  - Loads React tool component (lazy, ~50KB bundle)
  - Applies base styles (no external CSS dependency)
  - CORS: allow * for embed scripts
  - Submits results back to: POST https://agency.brand.com/api/tools/<slug>/capture
  - Rate limiting: 5 completions/IP/hour (Redis)
  - Email capture: opens overlay inline, no redirect

==============================================================
TOOL CALCULATION ENGINE (DETERMINISTIC MATH)
==============================================================
Principle: All tool math is pure functions. Same input = same output. No LLM for numbers.

Example: CAC Payback Estimator
  inputs: monthlyCACCents, monthlyRevenuePerCustomer, grossMarginPercent
  formula: paybackMonths = monthlyCACCents / (monthlyRevenuePerCustomer * (grossMarginPercent / 100))
  edge cases: if any input <= 0 return error, not NaN
  test: Vitest test with 5 known input/output pairs vs manual spreadsheet

All 36 tool calculation functions:
  Pure TypeScript functions in packages/tools/calculations/<tool-slug>.ts
  Unit tested: Vitest
  Input validation: zod schema (reject invalid types, negative values, etc)
  No LLM in calculation path
  LLM only for: result insights text (3 sentences, Flash-Lite, generated after calculation)

==============================================================
TOOL RESULT STORAGE
==============================================================
Tool results are NOT stored in database by default.
PDF captured result: stored in R2 after email submitted.
  Path: tools/<agencyId>/<toolSlug>/<sessionId>.pdf
  Shareable link: signed URL (30d expiry, noindex, no separate page indexed)
  Re-send: user can re-enter email on confirmation page to resend PDF

Anonymous session tracking (pre-email-capture):
  Client-side sessionStorage: stores inputs + result during session
  No server-side session stored before email
  After email submit: contact created in CRM, result attached as activity

==============================================================
PRE-SEEDED BENCHMARK SOURCES (QUALITY VERIFICATION)
==============================================================
All benchmark sources must be:
  - Publicly accessible URL
  - Published by known organization
  - Dated within 12 months of seed
  - Cited in tool page content (visible to readers)

Seeder verifies at seed time:
  1. URL is accessible (HTTP 200)
  2. Date extracted from page (or metadata)
  3. Date is within 12 months
  4. If date check fails: seed warns, does not block (manual review needed)

Benchmark refresh workflow (post-launch):
  - Admin dashboard shows benchmark expiry dates per tool
  - 30d warning: email to admin
  - On expiry: yellow warning banner on tool page
  - Admin updates: re-seeds benchmark_data + benchmark_updated_at
  - Admin removes AI badge and disclaimer until verified fresh

==============================================================
NICHE-SPECIFIC TOOL DESIGN RULES
==============================================================
Finance tools: extra caution on numbers. Add disclaimer:
  "This is an estimate only. Consult a qualified CPA or financial advisor."

Legal/compliance tools (if any): Add:
  "This tool does not constitute legal advice."

All tools: Add:
  "Estimates based on industry averages. Individual results vary significantly."
  "Benchmark data sourced from [Source Name] ([Year])."

FTC compliance on tool results:
  Never show "You will save $X" (guaranteed result language)
  Always show "You could save approximately $X based on industry benchmarks"
  Result copy: "based on", "estimated", "typically", "on average"

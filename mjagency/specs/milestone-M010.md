MILESTONE M010 - TOOLS + PITCH + PDF + VISUAL BUILDER
Branch: milestone/M010-tools-pitch-pdf-builder
Model: claude-sonnet-4-6
Depends on: M009 complete
Read: specs/tools.md (full), specs/crm.md (proposals + invoicing sections)

GOAL: 36 tools live with full content, proposal builder, e-sign, invoicing,
      Puck visual builder polished and fully functional.

SLICES:

SLICE 1: Tool Engine Core
  Task 1.1: packages/tools calculation engine
    - Plugin architecture: config + calculate() function + benchmark data
    - Deterministic math: same input = same output (no randomness, no LLM for numbers)
    - Input validation: sanitize before calculate
    - Result: score (0-100) + breakdown + benchmark comparison
    - PDF generation: branded per agency (Puppeteer or React-PDF)
    - CRM hook: email capture -> createContact() -> enroll tool sequence
  Task 1.2: Tool embed system
    - <script> embed snippet generated per tool
    - Works on external sites without authentication
    - CORS: allow * for embed scripts (tool is public)
    - Rate limiting on embed (5 completions/IP/hour)

SLICE 2: 36 Tools Built (3 per agency x 12)
  Task 2.1: main tools (3)
    Agency Readiness Score, Platform ROI Calculator, Market Gap Finder
  Task 2.2: ecommerce tools (3)
    Ecommerce Revenue Audit, Cart Abandonment Cost Calculator, Conversion Rate Benchmarker
  Task 2.3: growth tools (3)
    Growth Velocity Calculator, MQL-to-SQL Conversion Analyzer, CAC Payback Estimator
  Task 2.4: webdev tools (3)
    Website Performance Grader, Tech Stack Cost Calculator, Dev ROI Estimator
  Task 2.5: ai tools (3)
    AI Readiness Score, Automation ROI Calculator, AI Cost vs Build Estimator
  Task 2.6: branding + strategy tools (6)
    Brand Consistency Audit, Rebranding ROI Calculator, Visual Identity Scorer,
    Strategic Gap Analyzer, Decision Speed Calculator, OKR Health Checker
  Task 2.7: finance + engineering tools (6)
    Cash Flow Health Score, Tax Savings Estimator, Financial Runway Calculator,
    Project Scope Estimator, Technical Debt Calculator, Build vs Buy Analyzer
  Task 2.8: product + video + graphic tools (9)
    PMF Score, Feature Prioritization Matrix, Roadmap ROI Estimator,
    Video ROI Calculator, Content Production Cost Estimator, Video Performance Benchmarker,
    Design ROI Calculator, Brand Asset Audit, Creative Output Benchmarker
  Each tool: benchmark data loaded, result renders <2s, PDF generates, CRM hook fires

SLICE 3: Tool Page Content (content-complete)
  Task 3.1: All 36 tool pages have 2200+ words (see specs/tools.md for structure)
    - AI-drafted per niche via LiteLLM Flash-Lite
    - All sections: hero, how-it-works, benchmark-context, result-interpretation,
      use-cases, common-mistakes, FAQ (6+), related tools, CTA
    - Meta title + description per tool
    - FAQ schema auto-applied
    - Benchmark citations linked (real sources, dated)
    - Validators pass: word count, alt text, citations, placeholders

SLICE 4: Proposal Builder
  Task 4.1: Proposal page
    - Hosted at /proposals/<slug> (Payload collection)
    - Full agency theme applied
    - Sections: summary, scope, deliverables, timeline, investment, terms, e-sign
    - Pricing table: toggleable line items, multiple tiers
    - View tracking: time-on-page, sections viewed (server-sent events)
    - Expiry: 14d countdown visible to client
    - On expiry: CRM -> Proposal Expired substage
  Task 4.2: AI proposal generation
    - Owner fills: client name, service, budget range, timeline, pain point
    - Sonnet drafts full proposal (brand voice loaded)
    - Owner reviews + edits before sending
    - All proposal templates pre-seeded per agency

SLICE 5: E-sign + Signed PDF
  Task 5.1: E-sign flow (ESIGN Act compliant)
    - Client accepts proposal -> e-sign block activates
    - Draw signature (canvas) or type signature
    - Email verification: OTP sent to client email before signing
    - On sign: generate signed PDF (signature overlay + timestamp + IP + email)
    - Store: R2 at proposals/<agencyId>/<dealId>/signed-<timestamp>.pdf
    - Email both parties: signed PDF attached
    - CRM: deal -> Won, deposit invoice auto-generated
    - Audit trail: signer name, email, IP, timestamp, intent - stored on deal row
  Task 5.2: Client portal (read-only)
    - /portal/<signedToken> (time-limited, signed URL)
    - Client views: all proposals, all invoices, signed contracts
    - Download: PDFs
    - No editing, no account required

SLICE 6: Stripe + PayPal Invoicing
  Task 6.1: Invoice engine
    - Invoice types: deposit, milestone, recurring, final, ad-hoc
    - On e-sign: deposit invoice auto-created + emailed
    - Stripe Invoicing API (0.4% fee per paid invoice, capped $2)
    - PayPal alternative: same invoice, client picks payment method
    - ACH encouraged for large invoices (Stripe ACH: 0.8%, capped $5)
  Task 6.2: Payment reminders + dunning
    - Auto reminders: 3d before, on due date, 3d after, 7d after
    - Dunning escalation at 14d overdue: owner alerted
    - Idempotency: Redis key stripe:event:<id> before processing
    - Raw body: const body = await req.text() (MUST for Stripe signature)
  Task 6.3: Partial payments + refunds
    - Partial: balance tracked, CRM substage updates
    - Refund: owner-initiated via CRM or Stripe dashboard
    - Chargeback: auto-compile evidence (proposal + e-sign audit + email logs)
    - Invoice states: draft -> sent -> viewed -> paid -> refunded -> disputed

SLICE 7: Puck Visual Builder Polish
  Task 7.1: All 45 blocks fully configured in Puck
    - Block configs: all fields, all variants, all render functions
    - Drag-to-reorder: smooth, mobile-friendly
    - Add block: library drawer with search + categories
    - Block variants: visual picker in block toolbar
  Task 7.2: Meta panel completion
    - All fields in specs/cms.md meta panel section
    - SEO score updates in real-time while editing meta fields
    - OG card live preview in panel
  Task 7.3: Image replacement flow
    - Click image -> "Replace image" overlay
    - Opens 4-tab picker (Upload/Library/Stock/AI Generate)
    - Alt text prompt after selection (required, can't save without)
    - ΔE check + niche style check on new image
    - In-place preview before confirm

SUCCESS CRITERIA:
  All 36 tool pages load with real content (2200+ words each, validators pass)
  Tool math: test 5 inputs vs manual spreadsheet calculation (exact match)
  PDF generates and emails for any tool result (e2e test)
  Proposal: view tracking fires when client opens (SSE event logged)
  E-sign: signed PDF generated, stored in R2, both parties emailed (e2e test)
  E-sign: CRM deal -> Won automatically after signing (test)
  Invoice: deposit auto-created after e-sign (test)
  Stripe raw body: signature verification passes (test with Stripe CLI)
  Puck: all 45 blocks draggable and editable in builder
  Client portal: signed contract viewable via signed URL

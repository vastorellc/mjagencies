scripts/seed-plan.md - MJAgency Seed Execution Plan

==============================================================
OVERVIEW
==============================================================
Content seed runs for all 12 agencies before launch.
Each agency seeded in sequence (not parallel) to respect Cloudflare Images rate limits.
Estimated time per agency: 8-15 minutes.
Total for all 12: 90-180 minutes.
Run in Phase 12 off-hours (before launch window).

==============================================================
SEED ORDER PER AGENCY
==============================================================
Step 1: Database schema seed
  - Agency record created
  - Settings table populated (brand identity placeholders)
  - Feature flags set to defaults

Step 2: CRM seed (runs in parallel within agency)
  - Pipeline stages (9 default + niche overrides)
  - Tags (30 per agency, niche-specific)
  - Custom fields (10 per agency, niche-specific)
  - Email templates (10+ per agency, AI-drafted)
  - SMS templates (5 per agency, AI-drafted)
  - Sequences (8 per agency, AI-drafted)
  - Workflows (12 per agency, configured)
  - Lead scoring rules (niche weights)

Step 3: Booking seed
  - Cal.com meeting types (6 per agency)
  - Reminder sequences
  - Booking page copy

Step 4: Tool seed
  - Tool records (3 per agency)
  - Benchmark datasets (real sources, dated)
  - Tool page content (2200+ words each, AI-drafted)
  - Email sequences post-capture

Step 5: Content seed (calls LiteLLM Flash-Lite)
  NOTE: Requires M005 cms-collections slice complete first.
  - 3 cornerstone blog posts (1500-3000 words each)
  - Services hub page (800+ words)
  - 3-5 service detail pages (1500+ words each)
  - FAQ page (10+ entries)
  - Glossary terms (10+)
  - About page (1000+ words)
  - Contact page (300+ words)
  - Legal pages (Privacy, Terms, Cookie - US standard)
  - 404 and 500 pages
  - Meta titles + descriptions for all pages

Step 6: Media seed
  - Niche illustrations (30 per agency, from DAM)
  - Service icons (from DAM)
  - Process icons (from DAM)
  - Hero images (from stock API or AI-generated, graded to niche)
  - NOTE: Real photography must be uploaded manually by owner
    (cannot be automated - requires real photos with permissions)

Step 7: Validation run
  - Word count check on all seeded content
  - Alt text check on all seeded media
  - Schema validation on all seeded pages
  - Placeholder text scan (fail if found)

==============================================================
ROLLBACK STRATEGY
==============================================================
Each agency seed runs in a database transaction.
If any step fails for agency N:
  - That agency's transaction is rolled back
  - Error is logged with specific failure point
  - Other agencies are unaffected
  - Re-run with: pnpm seed --agency=<name> --resume

If media upload fails (Cloudflare rate limit):
  - Exponential backoff (1s, 2s, 4s, max 30s)
  - Log failed uploads
  - Re-run media step: pnpm seed --agency=<name> --step=media

==============================================================
REAL PHOTOS (MANUAL STEP)
==============================================================
Real photos cannot be automated. They require:
  - Actual photoshoot with US-based photographer
  - Permission forms signed by subjects
  - Photos uploaded to DAM with permissions linked
  - Color grade review (niche LUT applied)

Timeline:
  - Schedule photoshoot in week 0 of content sprint
  - Photos arrive within 7 days of shoot
  - Upload to DAM before Phase 12

Fallback if photos not ready:
  - Initials avatar with brand color (automated)
  - Never stock photos of people
  - Team section hidden until real photos available

==============================================================
BRAND SETUP WIZARD (OWNER TASK - POST GENERATE)
==============================================================
This is the ONLY task remaining for the owner after generation.

Step 1: Upload logo
  - Primary logo (required)
  - Symbol/icon logo (required)
  - Light variant (optional, auto-derived)
  - Favicon (auto-derived from symbol)

Step 2: Brand color
  - Primary brand color picker
  - System runs delta-E check against pre-seeded imagery
  - If >50% images fail: suggest palette or apply overlay
  - Color within niche guardrails always passes

Step 3: Brand identity
  - Agency name (required)
  - Tagline (required)
  - Mission statement (required)
  - Tone descriptors (3-5 words)

Step 4: API keys
  - Stripe Connect (required for invoicing)
  - Cal.com (required for booking)
  - Email provider - Postmark/SendGrid/SES (required)
  - Twilio (required for SMS)
  - Clearbit/Apollo (optional, for lead enrichment)

Step 5: DNS pointing
  - Point subdomain to VPS IP
  - Cloudflare handles SSL automatically

Step 6: Email warm-up
  - DKIM/SPF/DMARC validates automatically
  - 35-day warm-up begins
  - Sequences stay in DRAFT mode for 35 days
  - Owner activates manually after warm-up

Completion: <30 minutes for owner.
Reminder emails: sent at day 3 and day 7 if wizard incomplete.

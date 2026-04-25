MILESTONE M007 - AI ASSISTANT + ANTI-FABRICATION
Branch: milestone/M007-ai-assistant
Model: claude-sonnet-4-6
Depends on: M005 complete
Parallel with: M006
Read: specs/cms.md (AI section), specs/content.md (AI policy)

GOAL: LiteLLM gateway, 20 AI features in editor, all guards active.

SLICES:

SLICE 1: LiteLLM Gateway
  Task 1.1: packages/ai LiteLLM client
    - Single LiteLLM gateway instance
    - Per-agency virtual keys with budget caps
    - Model routing config:
        drafting/inline: gemini-2.5-flash-lite
        complex writing: claude-sonnet-4-6
        research: gemini-2.5-pro
        max quality: claude-opus-4-6
    - Cost tracking: per-agency monthly rollup
    - Rate limiting: per-agency concurrent request limit
  Task 1.2: Brand voice loading
    - Per-agency: tone descriptors, glossary, banned phrases
    - Loaded into system prompt on every LiteLLM call
    - PII redactor runs before ALL calls (strip emails, phones, names)
    - Prompt injection protection: wrap user content in XML tags

SLICE 2: 20 AI Features in CMS Editor
  Task 2.1: Inline text features (Flash-Lite)
    1. AI rewrite (3 variants shown inline, user picks)
    2. AI expand selection
    3. AI shorten selection
    4. AI tone adjustment (formal/casual/technical)
    5. AI brand voice rewrite
  Task 2.2: Content generation features
    6.  AI draft paragraph from prompt
    7.  AI rewrite heading (SEO-focused)
    8.  AI generate FAQ from page content
    9.  AI suggest internal links (embeddings match)
    10. AI TL;DR auto-generate (for AIO)
    11. AI meta description suggestion
    12. AI alt text for image
    13. AI page outline from brief
  Task 2.3: Analysis features (Sonnet/Flash-Lite)
    14. AI cannibalization detector (intent overlap check)
    15. AI content gap suggester (vs competitors/topic)
    16. AI citation finder (suggest authoritative sources)
    17. AI snippet rewriter (for featured snippet targeting)
    18. AI PAA suggester (People Also Ask)
    19. AI schema generator (HowTo, FAQ, Article)
    20. AI content polish (grammar, flow, clarity)

SLICE 3: Anti-Fabrication Guards
  Task 3.1: Stat detector
    - Regex + ML classifier detects unsourced statistics
    - Pattern: "X% of Y" or "X million" without citation
    - Blocks publish if stat without [source] link
    - Also blocks: "studies show", "experts say" without attribution
  Task 3.2: Quote detector
    - Detects quoted material without attribution
    - Pattern: text in quotation marks without source
    - Blocks publish without source link + name
  Task 3.3: Placeholder linter
    - Blocks: "lorem", "ipsum", "TODO", "[insert]", "Coming soon"
    - "TBD", "placeholder", "FIXME", "your text here"
    - Runs on every save attempt
  Task 3.4: Jailbreak classifier
    - Flash-Lite pre-classifier before expensive model calls
    - Blocks known injection patterns in user content
    - Logs attempts to audit log
  Task 3.5: AI content ratio tracker
    - Per Lexical field: tracks ai_generated_word_count + total_word_count
    - Incremented when AI assist used on field
    - Page ratio = sum of all fields
    - >70% ratio: auto-attaches disclosure metadata
    - Disclosure footer: "Some content was generated with AI assistance"

SLICE 4: Content Sprint AI Engine
  Task 4.1: Bulk content generation for seed
    - Agency-scoped prompts (niche + brand voice + content spec)
    - Batch generation: one agency at a time
    - Writes to Payload CMS REST API
    - Runs all validators on each save
    - Logs pass/fail per content item
    - Retry failed items (max 3 attempts)
    - Report: agencies complete, content items created, failures

SLICE 5: DB Schema + Cost Tracking
  Task 5.1: Drizzle schema
    - ai_usage table: id, agency_id, feature_id, model_used, input_tokens,
      output_tokens, cost_usd, created_at
    - ai_content_ratio table: id, agency_id, page_id, ai_word_count,
      total_word_count, ratio, disclosure_required, updated_at
    - ai_jailbreak_log table: id, agency_id, content_hash, pattern_matched,
      blocked_at (audit only, no content stored)
    - RLS on all tables by agency_id
  Task 5.2: Cost cap enforcement
    - LiteLLM budget manager: per-agency monthly cap configured on virtual key
    - Budget exceeded: AI features return soft error ("AI assist unavailable")
    - Budget alert: at 80% and 100% of monthly cap -> admin email
    - Cost dashboard: monthly rollup per agency per feature in admin panel
  Task 5.3: Additional Vitest tests
    - Stat detector: input "37% of users" without citation -> blocked
    - Quote detector: quoted text without source -> blocked
    - Placeholder linter: "TODO" anywhere in body -> blocked at publish
    - AI ratio >70%: disclosure metadata attached to page row
    - Jailbreak: known injection pattern in input -> blocked, logged
    - PII strip: email/phone in input -> stripped before LiteLLM call

SUCCESS CRITERIA:
  AI rewrite: 3 variants shown inline within 3s (Playwright test)
  Stat without source: blocked at publish (Vitest)
  PII stripped from LiteLLM calls (Vitest with mock PII input)
  Per-agency cost cap enforced (LiteLLM budget test)
  Placeholder "TODO" blocked at publish (Vitest)
  Brand voice loaded correctly per agency (integration test)
  Content sprint: generates 1 agency full content without errors (M007 e2e)
  AI ratio: >70% page gets disclosure_required=true in DB (hook test)
  Jailbreak: blocked pattern logged to ai_jailbreak_log (audit test)
  Cost dashboard: reads ai_usage rollup correctly (tRPC test)

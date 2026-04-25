MILESTONE M006 - SEO/AIO/GEO PLUGIN ENGINE
Branch: milestone/M006-seo-aio-geo-plugins
Model: claude-sonnet-4-6
Depends on: M005 complete
Parallel with: M007 (both depend only on M005)
Read: specs/content.md (SEO/AIO/GEO sections)

GOAL: 3 SEO plugins running, parameter store in admin, self-learning loop.

SLICES:

SLICE 1: Plugin Runtime + Parameter Store
  Task 1.1: packages/seo plugin architecture
    - Plugin runtime: each plugin = config row + scorer function + admin UI
    - Parameter store: all weights/rules/severities editable in Payload admin (no code)
    - Per-agency plugin overrides table
    - Versioning: plugin config versioned, rollback supported
    - Canary: new config deployed to 5% traffic before full rollout
    - Auto-rollback: if conversion drops >15% vs baseline

  Task 1.2: SEO score engine
    - Scores: 0-100 per plugin + combined score
    - Inputs: page content, meta fields, structure, images
    - Output: score + per-rule breakdown + suggestions
    - Real-time: debounced 500ms, triggers on every content change
    - Stored: seo_score column on pages/posts table

SLICE 2: seo-classic Plugin
  Task 2.1: Classic on-page SEO scoring
    - H1 present and keyword included: +15 points
    - Meta title: 50-60 chars, keyword present: +10
    - Meta description: 130-160 chars, keyword, CTA: +10
    - Keyword density: 0.5-2%: +10
    - Internal links >= 3: +10
    - External citation >= 1: +10
    - Alt text on all images: +10
    - Word count above floor: +10
    - Heading structure logical: +10
    - Schema present: +5
    - Last reviewed date: +5
  Task 2.2: SERP preview
    - Real-time SERP preview as user types title/description
    - Mobile + desktop SERP views
    - Snippet preview

SLICE 3: aio-citations Plugin
  Task 3.1: AI Mode optimization scoring
    - TL;DR present (<=120 chars, answers query): +20
    - Direct answer format (H2=question, answer in first para): +20
    - Structured data richness: +15
    - Citation-friendly chunking (H2/H3 every 300 words): +15
    - Stat highlighting (numbers sourced): +15
    - Author credentials + sameAs: +15
  Task 3.2: AIO suggestions
    - "Add TL;DR" button (AI drafts it, admin approves)
    - "Restructure for direct answer" suggestion
    - Citation gap detection ("This stat needs a source")

SLICE 4: geo-chunking Plugin
  Task 4.1: Generative engine optimization
    - Content chunked for AI consumption (clear H2/H3 hierarchy)
    - Entity linking (first mention of brand/concept linked)
    - Confidence signals: sourced claims, dated content, attributed quotes
    - llms.txt auto-generation per agency
    - OpenAPI endpoint: /api/llms.txt (machine-readable agency description)

SLICE 5: Self-Learning Loop
  Task 5.1: Signal collection
    - GSC data ingestion (Google Search Console API)
    - GA4 engagement signals
    - AI citation logs (when available)
  Task 5.2: AI tuner
    - Flash-Lite analyzes signal patterns
    - Generates weight adjustment suggestions
    - Suggestions appear in super_admin inbox
    - Admin approves/rejects changes
  Task 5.3: Algorithm watcher
    - RSS monitoring: Google Search Central, AI search blogs
    - Flash-Lite summarizes changes
    - Alert if algorithm change detected
    - Suggestion: "Review [plugin parameter] based on recent Google update"

SLICE 6: DB Schema + Integration
  Task 6.1: Drizzle schema
    - seo_configs table: id, agency_id, plugin_id, config_json (JSONB),
      version, is_active, created_at
    - seo_scores table: id, agency_id, page_id, seo_score, aio_score,
      geo_score, score_breakdown (JSONB), scored_at
    - algorithm_alerts table: id, agency_id, source, summary, created_at
    - RLS on all tables by agency_id
  Task 6.2: tRPC routes
    - seo.getConfig (agency-scoped, per plugin)
    - seo.saveConfig (validate config JSON before save)
    - seo.getScore (by page_id)
    - seo.getSuggestions (returns ranked suggestion list)
    - seo.getAlerts (algorithm watcher feed)

SUCCESS CRITERIA:
  SEO score panel updates in real-time in Lexical editor (Playwright: type -> score changes)
  All 3 plugins configurable from Payload admin without code changes
  Per-agency overrides: agency A config does not affect agency B (isolation test)
  TL;DR suggestion: AI drafts and admin approves (e2e test)
  SERP preview: renders correct title + description as user types
  llms.txt served correctly at /api/llms.txt per agency subdomain
  Self-learning: tuner suggestions appear in super_admin inbox (integration test)
  DB: seo_scores row written after each page publish (hook test)
  Algorithm watcher: RSS fetch runs without error in test environment

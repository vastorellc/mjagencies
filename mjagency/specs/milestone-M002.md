MILESTONE M002 - MULTI-TENANT DB + MIGRATION ORCHESTRATOR
Branch: milestone/M002-multitenant-db
Model: claude-opus-4-6 (architecture milestone)
Depends on: M001 complete
Read: specs/architecture.md (database + security sections)

GOAL: Per-agency PostgreSQL 17, full Drizzle schema with RLS on every table,
      migration runner, seed framework, backup automation, permissions vault,
      audit log. The entire data foundation the platform rests on.

==============================================================
SLICE 1: Drizzle ORM Schema + RLS
==============================================================
Task 1.1: packages/db/schema.ts — all tables

  agencies table:
    id uuid PK default gen_random_uuid()
    slug varchar(63) UNIQUE NOT NULL
    name varchar(255) NOT NULL
    subdomain varchar(63) UNIQUE NOT NULL
    is_active boolean default true
    created_at timestamptz default now()
    updated_at timestamptz default now()

  agency_settings table:
    id uuid PK
    agency_id uuid NOT NULL REFERENCES agencies(id) immutable
    brand_voice text
    glossary jsonb default '[]'
    banned_phrases jsonb default '[]'
    seo_defaults jsonb default '{}'
    timezone varchar(64) default 'America/New_York'
    created_at / updated_at timestamptz

  pages table (agency-scoped):
    id uuid PK
    agency_id uuid NOT NULL immutable
    slug varchar(255) NOT NULL
    title varchar(255) NOT NULL
    status varchar(20) NOT NULL default 'draft' (draft|review|scheduled|published)
    blocks jsonb NOT NULL default '[]'  -- Puck block JSON
    seo_title varchar(70)
    seo_description varchar(170)
    aio_tldr varchar(130)
    og_image_id uuid
    canonical_url text
    schema_type varchar(50)
    robots varchar(50) default 'index,follow'
    ai_word_count integer default 0
    total_word_count integer default 0
    last_reviewed_at timestamptz
    published_at timestamptz
    created_at / updated_at timestamptz
    UNIQUE(agency_id, slug)

  posts table (agency-scoped):
    id, agency_id (immutable), title, slug, status, content jsonb (Lexical JSON),
    author_id, excerpt, featured_image_id, seo_title, seo_description,
    aio_tldr, schema_type, focus_keyword, word_count, ai_word_count,
    reading_time_minutes, published_at, scheduled_at, created_at, updated_at
    UNIQUE(agency_id, slug)

  authors table:
    id, agency_id (immutable), name, bio text, photo_id, credentials text,
    linkedin_url, same_as jsonb, created_at, updated_at

  categories table:
    id, agency_id (immutable), name, slug, description, parent_id,
    created_at, updated_at
    UNIQUE(agency_id, slug)

  media_assets table:
    id, agency_id (immutable), filename, original_url, cdn_url,
    mime_type, file_size_bytes, width, height, alt_text,
    blurhash, dominant_color, palette jsonb, caption,
    permission_id uuid, permission_expires_at timestamptz,
    status varchar(20) (draft|approved|published|paused|archived),
    is_ai_generated boolean default false, is_stock boolean default false,
    asset_type varchar(30) (photo|illustration|icon|video|document|svg),
    usage_count integer default 0, fatigue_score integer default 0,
    embeddings vector(1536), created_at, updated_at

  tools table:
    id, agency_id (immutable), name, slug, tool_type, config jsonb,
    benchmark_data jsonb, benchmark_updated_at timestamptz,
    benchmark_source text, content jsonb (Lexical), word_count,
    seo_title, seo_description, status, created_at, updated_at

  crm_contacts table:
    id, agency_id (immutable), email, phone, first_name, last_name,
    company, job_title, website, state varchar(2),
    score integer default 0, score_band varchar(10),
    first_touch_source, last_touch_source, all_touches jsonb,
    sms_opt_in boolean default false, sms_opt_in_at timestamptz,
    marketing_unsubscribed boolean default false,
    marketing_unsubscribed_at timestamptz,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer_url, landing_page, status, tags jsonb, custom_fields jsonb,
    created_at, updated_at
    UNIQUE(agency_id, email)

  crm_accounts table:
    id, agency_id (immutable), name, domain, industry,
    employee_count, annual_revenue, state, website,
    created_at, updated_at

  crm_deals table:
    id, agency_id (immutable), contact_id, account_id, name,
    stage varchar(50), stage_entered_at timestamptz,
    value_cents integer, currency varchar(3) default 'USD',
    proposal_id, invoice_id, won_at, lost_at, lost_reason,
    first_touch_source, all_touches jsonb, status,
    created_at, updated_at

  crm_activities table:
    id, agency_id (immutable), contact_id, deal_id,
    type varchar(30) (email|call|sms|meeting|note|form_submit|tool_complete),
    subject, body text, direction varchar(10) (inbound|outbound),
    occurred_at timestamptz, metadata jsonb, created_at

  crm_tasks table:
    id, agency_id (immutable), contact_id, deal_id, title,
    description, due_at timestamptz, priority varchar(10),
    status varchar(20) default 'open', sla_breach_at timestamptz,
    created_at, updated_at

  crm_sequences table:
    id, agency_id (immutable), name, trigger_type, steps jsonb,
    is_active boolean, created_at, updated_at

  crm_templates table:
    id, agency_id (immutable), type varchar(10) (email|sms),
    name, subject, body text, merge_tags jsonb, created_at, updated_at

  proposals table:
    id, agency_id (immutable), deal_id, slug UNIQUE, title,
    content jsonb, status varchar(20), expires_at timestamptz,
    viewed_at timestamptz, view_count integer default 0,
    signed_at timestamptz, signer_name, signer_email, signer_ip,
    signed_pdf_r2_key text, created_at, updated_at

  invoices table:
    id, agency_id (immutable), deal_id, stripe_invoice_id UNIQUE,
    type varchar(20), amount_cents integer, currency varchar(3),
    status varchar(20), due_at timestamptz, paid_at timestamptz,
    refunded_at timestamptz, refund_amount_cents,
    dispute_id, created_at, updated_at

  bookings table:
    id, agency_id (immutable), contact_id, deal_id,
    cal_event_uid UNIQUE, meeting_type, title,
    starts_at timestamptz, ends_at timestamptz, timezone,
    status varchar(20), video_link, outcome text, created_at, updated_at

  audit_log table:
    id uuid PK, agency_id, actor_id, actor_email, action varchar(100),
    resource_type, resource_id, metadata jsonb, ip_address inet,
    user_agent text, previous_hash varchar(64), current_hash varchar(64),
    key_id varchar(50), occurred_at timestamptz
    -- hash-chained: current_hash = HMAC-SHA256(previous_hash + row_data, signing_key)

  user_sessions table:
    id uuid PK, user_id, agency_id, jti varchar(36) UNIQUE,
    family_id varchar(36), refresh_token_hash varchar(64),
    expires_at timestamptz, revoked_at timestamptz,
    ip_address inet, user_agent text, created_at

  permissions_vault table:
    id, agency_id (immutable), asset_id, permission_type varchar(30),
    granted_by, granted_to, file_r2_key text (encrypted),
    expires_at timestamptz, notes text, created_at, updated_at

  refresh_tokens table:
    id, jti varchar(36) UNIQUE, family_id varchar(36),
    user_id, agency_id, token_hash varchar(64), revoked boolean default false,
    expires_at timestamptz, created_at

  rum_events table:
    id, agency_id, page_url, metric_name varchar(10),
    metric_value numeric, rating varchar(10), device_type,
    browser, connection_type, occurred_at timestamptz

Task 1.2: RLS policies on ALL agency-scoped tables
  CREATE POLICY agency_isolation ON <table>
    USING (agency_id = current_setting('app.current_agency_id', true)::uuid);

  DB helper in packages/db/rls.ts:
    export async function withAgency(db, agencyId, fn) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL app.current_agency_id = ${agencyId}`)
        return fn(tx)
      })
    }

Task 1.3: pgvector extension + embeddings index
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE INDEX ON media_assets USING ivfflat (embeddings vector_cosine_ops);
  Dimension: 1536 (OpenAI ada-002 compatible)

==============================================================
SLICE 2: PgBouncer Per Agency
==============================================================
Task 2.1: PgBouncer configs (13 total)
  Transaction mode (NEVER session mode - breaks per-request SET LOCAL)
  pool_size=20 per agency
  Port mapping: main=6432, ecommerce=6433, growth=6434,
                webdev=6435, ai=6436, branding=6437, strategy=6438,
                finance=6439, engineering=6440, product=6441,
                video=6442, graphic=6443, (reserve=6444)
  max_client_conn=100 per instance
  server_idle_timeout=600
  PM2 manages each PgBouncer process

Task 2.2: Connection utilities in packages/db
  getDatabaseUrl(agencySlug): string -> reads from Doppler
  createDrizzleClient(agencySlug): DrizzleClient (pool through PgBouncer)
  Health check: GET /api/health/db -> checks each agency DB responds

==============================================================
SLICE 3: Migration Runner
==============================================================
Task 3.1: scripts/migrate/runner.ts
  Options:
    --agency <slug|all>   target specific agency or all 13
    --dry-run             print SQL without executing
    --canary <slug>       run on one agency first, inspect, then all
    --rollback <n>        rollback last n migrations per agency
    --parallel            run all agencies simultaneously

  Migration state: migration_history table per agency DB
    id, migration_name, applied_at, checksum, rolled_back_at

  Safety: if migration_history checksum mismatch → abort with error
  Parallel mode: Promise.all() across all 13 agencies, fail-fast

Task 3.2: Drizzle migration files
  Each migration: sequential number + description
  0001_initial_schema.sql
  0002_add_pgvector.sql
  0003_rls_policies.sql
  0004_add_indexes.sql
  etc.

==============================================================
SLICE 4: Seed Framework
==============================================================
Task 4.1: scripts/seed/index.ts
  CLI: pnpm seed --agency=<slug> [--step=<step>] [--resume]
  Per-agency, transactional (BEGIN...COMMIT / ROLLBACK on fail)
  Seed order per agency:
    1. agency record + settings
    2. default categories (blog + service categories)
    3. CRM pipeline stages + tags + custom fields
    4. CRM email templates (10+, niche-specific)
    5. CRM sequences (8, niche-specific)
    6. Cal.com meeting types (6, via Cal.com API)
    7. Tool records + benchmark data (3 per agency)
    8. Default redirects + settings

  Rollback: if any step fails → rollback entire agency transaction
  Resume: --resume --from=<step_number> skips completed steps
  Log: seed.log per agency with pass/fail per step

Task 4.2: Niche seed data files (packages/db/seeds/)
  seed-ecommerce.ts, seed-growth.ts, seed-webdev.ts, etc.
  Each exports: { pipeline, tags, templates, sequences, tools, meetingTypes }

==============================================================
SLICE 5: Backup Automation
==============================================================
Task 5.1: BullMQ backup job (runs hourly per agency)
  Steps:
    1. pg_dump --format=custom <agency_db> > dump.pgdump
    2. gpg --encrypt --recipient <key_fingerprint> dump.pgdump
    3. Upload to R2: backups/<agency>/<date>/<timestamp>.pgdump.gpg
    4. Verify: download + decrypt + check row count > 0
    5. Log: backup_logs table in main brand DB
    6. Alert: if any step fails → PagerDuty + Slack

Task 5.2: WAL streaming
  PostgreSQL WAL archiving: archive_command = 'aws s3 cp %p s3://...'
  (or R2-compatible path)
  archive_mode = on, wal_level = replica

Task 5.3: Quarterly DR test script
  scripts/dr-test.sh: restore one agency to staging, verify row counts,
  report pass/fail to Slack

==============================================================
SLICE 6: Permissions Vault + Audit Log
==============================================================
Task 6.1: Permissions vault
  Encrypted file storage: permission PDF/image uploaded to R2 (encrypted)
  R2 key stored on permissions_vault row
  Expiry alerts: BullMQ daily job checks permissions_vault.expires_at
  Alert 30 days out: email to admin
  On expiry: asset.status = 'paused' (auto-unpublish)

Task 6.2: Hash-chained audit log writer
  packages/db/audit.ts:
    async function writeAuditLog(tx, event) {
      const lastRow = await tx.select().from(audit_log)
        .where(eq(audit_log.agencyId, event.agencyId))
        .orderBy(desc(audit_log.occurred_at)).limit(1)
      const previousHash = lastRow[0]?.current_hash ?? '0'.repeat(64)
      const rowData = JSON.stringify({ ...event, previousHash })
      const currentHash = hmacSHA256(rowData, signingKey)
      await tx.insert(audit_log).values({ ...event, previousHash, currentHash, keyId })
    }

Task 6.3: Audit log verification script
  scripts/verify-audit-log.ts --agency=<slug>
  Walks entire audit log, recomputes hashes, reports any tampering

SUCCESS CRITERIA:
  pnpm migrate --agency=all --dry-run: prints SQL for all 13 DBs
  pnpm migrate --agency=all: runs clean, migration_history populated
  RLS test: cross-agency query returns empty (Vitest integration test)
  SET LOCAL timing: confirm SET LOCAL works in transaction mode PgBouncer
  pnpm seed --agency=ecommerce: completes in <15 min, no errors
  Backup: R2 shows encrypted file 1h after job starts
  Audit log: verify-audit-log.ts --agency=main returns "chain intact"
  pgvector: CREATE INDEX completes without error on media_assets

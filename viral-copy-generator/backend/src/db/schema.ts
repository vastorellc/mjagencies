// backend/src/db/schema.ts
import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb,
  index, foreignKey, unique
} from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { sql } from 'drizzle-orm'

// RLS helper — current user's UUID from Supabase Auth
const authUid = sql`(select auth.uid())`

// ============================================================
// posts
// ============================================================
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  title: text('title').notNull(),
  niche: text('niche').notNull(),
  virality_score: integer('virality_score').notNull().default(0),
  engine_signals: jsonb('engine_signals').$type<Record<string, unknown>>().notNull().default({}),
  ai_output: jsonb('ai_output').$type<Record<string, unknown>>().notNull().default({}),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'posts_user_id_fk',
  }).onDelete('cascade'),
  pgPolicy('posts_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
  index('posts_niche_created_idx').on(table.niche, table.created_at),
])

// ============================================================
// platform_posts
// ============================================================
export const platform_posts = pgTable('platform_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  post_id: uuid('post_id').notNull(),
  platform: text('platform').notNull(),
  upload_status: text('upload_status').notNull().default('idle'),
  platform_post_id: text('platform_post_id'),
  actual_views: integer('actual_views'),
  predicted_low: integer('predicted_low'),
  predicted_high: integer('predicted_high'),
  error_message: text('error_message'),
  posted_at: timestamp('posted_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'platform_posts_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.post_id],
    foreignColumns: [posts.id],
    name: 'platform_posts_post_id_fk',
  }).onDelete('cascade'),
  pgPolicy('platform_posts_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
  index('platform_posts_post_id_idx').on(table.post_id),
])

// ============================================================
// learning_signals
// ROADMAP note: post_id FK and hashtags TEXT[] array are required
// (spec omitted these — added per Phase 1 key implementation notes)
// ============================================================
export const learning_signals = pgTable('learning_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  post_id: uuid('post_id').notNull(),
  platform: text('platform').notNull(),
  niche: text('niche').notNull(),
  hook_text: text('hook_text').notNull(),
  hashtags: text('hashtags').array().notNull().default([]),
  actual_views: integer('actual_views'),
  overperformed: boolean('overperformed'),
  signal_weights: jsonb('signal_weights').$type<Record<string, number>>(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'learning_signals_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.post_id],
    foreignColumns: [posts.id],
    name: 'learning_signals_post_id_fk',
  }).onDelete('cascade'),
  pgPolicy('learning_signals_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
])

// ============================================================
// settings
// ROADMAP note: learned_weights JSONB column required
// (spec omitted this — added per Phase 1 key implementation notes)
// ============================================================
// SECURITY: OAuth tokens in PlatformConfig MUST be AES-256-GCM encrypted before
// writing to platform_config, and decrypted on read in the settings route.
// Store as { iv: string; cipher: string } — never write plaintext tokens to the DB.
export type PlatformConfig = {
  youtube?: { access_token: string; refresh_token: string; expiry: number } | null
  instagram?: { access_token: string; expiry: number } | null
  facebook?:
    | { access_token: string; page_id: string; expiry: number }
    | { setup_required: true }
    | null
}

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().unique(),
  ai_provider: text('ai_provider').notNull().default('gemini'),
  api_key_encrypted: text('api_key_encrypted'),
  default_niche: text('default_niche').notNull().default('travel'),
  enabled_platforms: text('enabled_platforms').array().notNull().default(['youtube', 'instagram', 'facebook']),
  platform_config: jsonb('platform_config').$type<PlatformConfig>().notNull().default({}),
  learned_weights: jsonb('learned_weights').$type<Record<string, number>>(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'settings_user_id_fk',
  }).onDelete('cascade'),
  pgPolicy('settings_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
])

// ============================================================
// Phase 9: Content Research Engine
// ============================================================

// TypeScript-only type aliases for JSONB columns
export type TrendItem = {
  title: string
  score: number
  source: 'youtube' | 'google-trends' | 'reddit' | 'exploding-topics'
  url?: string
}

export type ContentIdeaData = {
  title: string
  angle: string
  hookVariants: [string, string, string]
  scriptOutline: string
  keyMoments: Array<{ timestamp: string; description: string }>
  brollSuggestions: string[]
  platforms: string[]
  estimatedStrength: number
  gapWarnings: string[]
  hashtagSuggestions: string[]
}

// ============================================================
// trend_cache
// RESEARCH-06: Global cache — no user_id, no RLS needed.
// Shared across all users for the same (source, niche) pair.
// unique() NOT index() — ON CONFLICT (source, niche) requires UNIQUE constraint.
// ============================================================
export const trend_cache = pgTable('trend_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),
  niche: text('niche').notNull(),
  data: jsonb('data').$type<TrendItem[]>().notNull().default([]),
  fetched_at: timestamp('fetched_at').defaultNow().notNull(),
}, (table) => [
  unique('trend_cache_source_niche_unique').on(table.source, table.niche),
])

// ============================================================
// content_ideas
// RESEARCH-13: Per-user saved ideas with RLS.
// ============================================================
export const content_ideas = pgTable('content_ideas', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  idea: jsonb('idea').$type<ContentIdeaData>().notNull(),
  niches: text('niches').array().notNull().default([]),
  platforms: text('platforms').array().notNull().default([]),
  generated_at: timestamp('generated_at').defaultNow().notNull(),
  saved: boolean('saved').notNull().default(false),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'content_ideas_user_id_fk',
  }).onDelete('cascade'),
  pgPolicy('content_ideas_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
  index('content_ideas_user_generated_idx').on(table.user_id, table.generated_at),
])

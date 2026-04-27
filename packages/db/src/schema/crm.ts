/**
 * packages/db/src/schema/crm.ts
 *
 * Drizzle ORM schema for all five CRM tables.
 * All tables are RLS-enabled: rows are filtered by app.agency_id session variable.
 * agency_id is a FK to agencies(id) and is immutable at the application layer
 * (Payload fieldImmutable + no UPDATE allowed on the column).
 *
 * RLS policy pattern (mirrors Phase 2 pattern from 02-PLAN):
 *   ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY crm_contacts_agency_iso ON crm_contacts
 *     USING (agency_id = (current_setting('app.agency_id', true))::uuid);
 *
 * REQ-100 (contacts), REQ-101 (accounts), REQ-102 (deals),
 * REQ-103 (activities/tasks), REQ-302 (agency isolation)
 */

import { pgTable, uuid, text, timestamp, numeric, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const crmContacts = pgTable(
  'crm_contacts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    email: text('email').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    status: text('status').notNull().default('new'),
    // status values: new | qualified | closed_won | closed_lost
    source: text('source'),
    score: numeric('score', { precision: 5, scale: 2 }).default('0'),
    tags: jsonb('tags').$type<string[]>().default([]),
    externalId: text('external_id'), // used for idempotent seeding (Plan 09-07)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_contacts_agency_idx').on(t.agencyId),
    index('crm_contacts_email_agency_idx').on(t.email, t.agencyId),
    // Unique constraint on external_id enables ON CONFLICT DO NOTHING in seed steps
    uniqueIndex('crm_contacts_external_id_idx').on(t.externalId),
  ]
)

export const crmAccounts = pgTable(
  'crm_accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    name: text('name').notNull(),
    domain: text('domain'),
    industry: text('industry'),
    externalId: text('external_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('crm_accounts_agency_idx').on(t.agencyId)]
)

export const crmDeals = pgTable(
  'crm_deals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    title: text('title').notNull(),
    value: numeric('value', { precision: 12, scale: 2 }).default('0'),
    stage: text('stage').notNull().default('lead'),
    // stage values: lead | proposal | negotiation | won | lost
    accountId: uuid('account_id'),
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    externalId: text('external_id'), // used for idempotent seeding (Plan 09-07)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_deals_agency_idx').on(t.agencyId),
    // Unique constraint on external_id enables ON CONFLICT DO NOTHING in seed steps
    uniqueIndex('crm_deals_external_id_idx').on(t.externalId),
  ]
)

export const crmActivities = pgTable(
  'crm_activities',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    type: text('type').notNull(),
    // type values: email_sent | call | meeting | note
    contactId: uuid('contact_id'),
    dealId: uuid('deal_id'),
    loggedBy: uuid('logged_by'),
    body: text('body'),
    status: text('status').notNull().default('logged'),
    externalId: text('external_id'), // used for idempotent seeding (Plan 09-07)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_activities_agency_idx').on(t.agencyId),
    // Unique constraint on external_id enables ON CONFLICT DO NOTHING in seed steps
    uniqueIndex('crm_activities_external_id_idx').on(t.externalId),
  ]
)

export const crmTasks = pgTable(
  'crm_tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    title: text('title').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
    assignedTo: uuid('assigned_to'),
    contactId: uuid('contact_id'),
    dealId: uuid('deal_id'),
    status: text('status').notNull().default('open'),
    // status values: open | done
    externalId: text('external_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('crm_tasks_agency_idx').on(t.agencyId)]
)

/**
 * RLS migration SQL — apply via Drizzle migrate or a raw SQL migration file.
 * Exported so the migration runner can execute it after table creation.
 */
export const crmRlsSql = `
  ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY crm_contacts_agency_iso ON crm_contacts
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);

  ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY crm_accounts_agency_iso ON crm_accounts
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);

  ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
  CREATE POLICY crm_deals_agency_iso ON crm_deals
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);

  ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
  CREATE POLICY crm_activities_agency_iso ON crm_activities
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);

  ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
  CREATE POLICY crm_tasks_agency_iso ON crm_tasks
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);
`

# Phase 6: SEO/AIO/GEO Plugin Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 06-seo-plugin-engine
**Areas discussed:** Plugin parameter store, AIO TL;DR + FAQ schema authoring, Algorithm watcher

---

## Plugin parameter store

| Option | Description | Selected |
|--------|-------------|----------|
| Extend settings collection | Add seo_plugins JSON field to existing settings collection. No new migrations. | ✓ |
| Dedicated seo_configs collection | New collection, one doc per agency per plugin. More structured. | |
| Flat JSON file per agency | Not admin-editable — defeats REQ-071. | |

**User's choice:** Extend settings collection

---

| Option | Description | Selected |
|--------|-------------|----------|
| Merge patch (Recommended) | Global defaults in packages/seo; agency holds delta only. Merge at read. | ✓ |
| Full copy per agency | Complete copy per agency; no merge logic but drift is invisible. | |
| Inheritance flags | Boolean per field; verbose (40+ flags per plugin). | |

**User's choice:** Merge patch

---

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately, in-request (Recommended) | afterOperation hook invalidates Redis cache key. Next compute reads fresh. | ✓ |
| On next page publish | Config re-read at publish. Sidebar scores stay stale until publish. | |
| Background sync, 60s delay | BullMQ every 60s. Confusing delay for admins tweaking weights. | |

**User's choice:** Immediately via Redis cache invalidation

---

**Weight categories tunable (multiselect):** All 4 selected
- seo-classic weights ✓
- aio-citations config ✓
- geo-chunking config ✓
- Score thresholds ✓

---

## AIO TL;DR + FAQ schema authoring

| Option | Description | Selected |
|--------|-------------|----------|
| AI-generated, editor can edit (Recommended) | LiteLLM flash-lite drafts TL;DR on editor open. Editor edits in SeoPanel. Blocks publish if blank. | ✓ |
| Required field, editor writes it | Manual field. No AI assist. | |
| AI-generated only, no edit | Auto at publish. Editors can't fix bad output. | |

**User's choice:** AI-generated, editor can edit

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detected from FAQ block (Recommended) | FaqAccordion/FaqGrid block → plugin extracts Q/A → FAQPage JSON-LD. | |
| Dedicated FAQ collection | Separate Payload collection. Pages link to FAQ records. | ✓ |
| Editor tags content as FAQ | Lexical node type tags Q/A inline. Requires Phase 5 block retrofitting. | |

**User's choice:** Dedicated FAQ collection

---

| Option | Description | Selected |
|--------|-------------|----------|
| Has-many relationship on page (Recommended) | Pages.faqs has-many → aio-citations generates JSON-LD from related docs. | ✓ |
| FAQ items reference parent page | FAQ doc → page backref. N+1 query risk. | |
| Global FAQ pool, pages tag which | FAQs reusable across pages. Complex to manage. | |

**User's choice:** Has-many relationship on pages collection

---

| Option | Description | Selected |
|--------|-------------|----------|
| aio_tldr field on pages collection (Recommended) | Simple string field, indexed, publish hook validates ≤120 chars. | ✓ |
| Inside seo_meta JSON block | Grouped with meta_title/description. Requires nested path access. | |

**User's choice:** aio_tldr field on pages collection

---

## Algorithm watcher

**RSS feeds (multiselect):** 2 selected
- Google Search Central blog ✓
- Search Engine Land / SEJ ✓

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keyword list match (Recommended) | Configurable keywords in Payload settings. Simple, auditable. | ✓ |
| AI classification | LiteLLM per item. Smarter but adds cost + hallucination risk. | |
| Manual review only | No automation. Defeats purpose. | |

**User's choice:** Keyword list match

---

| Option | Description | Selected |
|--------|-------------|----------|
| Payload notification + dashboard flag (Recommended) | algo_alerts collection. Super admin dashboard. No external dependencies. | ✓ |
| Email to super_admin | BullMQ email. Requires SMTP (Phase 9). | |
| Both Payload + email | Most complete. Email requires Phase 9 infra. | |

**User's choice:** Payload notification + dashboard flag only (email deferred to Phase 9)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Every 6 hours (Recommended) | cron '0 */6 * * *'. Same-day coverage without hammering feeds. | ✓ |
| Every hour | Overkill for a low-frequency blog. | |
| Daily at midnight | Too slow for same-day alert. | |

**User's choice:** Every 6 hours

---

## Claude's Discretion

- Score computation algorithm internals (weighted sub-score math)
- RSS parsing library choice
- Redis key naming beyond the `agency:<id>:seo-config` prefix
- Exact plugin-defaults.ts data shape

## Deferred Ideas

- Self-learning loop (REQ-073) — not discussed; Claude has discretion per ROADMAP spec
- Email alerts for algo watcher — Phase 9 email engine prerequisite
- AI classification for RSS matching — future scope if keyword noise grows

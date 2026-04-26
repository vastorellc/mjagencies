---
phase: 05-central-cms
created: 2026-04-26
approved: 2026-04-26
status: approved
items:
  - id: UAT-05-01
    status: approved
  - id: UAT-05-02
    status: approved
---

# Phase 05 — Human UAT Checklist

Automated verification: **4/6 passed**. 2 items deferred to live-environment testing.
**Status: APPROVED 2026-04-26**

---

## UAT-05-01: Payload Admin Loads at /admin

**Pass criteria:**
- [x] Payload 3.82.1 admin UI renders without server errors
- [x] Login form appears
- [x] After logging in, all 11 collections appear in sidebar: pages, posts, authors, categories, media_assets, tools, forms, redirects, settings, templates, global_blocks
- [x] Opening a page/post shows SeoPanel in the right document controls sidebar

---

## UAT-05-02: Content Sprint Seed Script — Ecommerce Agency

**Pass criteria:**
- [x] Dry-run logs all ECOMMERCE_CONTENT_SPEC items without errors
- [x] Live run creates 1 author record (Alex Rivera) in Payload
- [x] Live run creates 5 page records (/, /about, /services, /contact, /tools/revenue-calculator)
- [x] Live run creates 2 blog post records
- [x] No content validation errors in logs (word count ≥ floor, ≥3 internal links, no exact % figures)
- [x] `isAiGenerated: true` present in generated content metadata

---

**Approved by user 2026-04-26 — advancing to Phase 06.**

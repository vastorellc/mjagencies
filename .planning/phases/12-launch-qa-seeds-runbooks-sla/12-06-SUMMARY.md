---
plan: 12-06
status: complete
wave: 1
---

## Summary

Created the public SLA page at /sla on web-main using RSC. Page follows the privacy/page.tsx pattern exactly: same import structure, Metadata export, style-object declarations, and RSC function signature. Severity badge colors use CSS classes (sla-badge--p1 through sla-badge--p4) in a co-located sla.css file instead of inline style objects, making them CSP nonce compliant under Phase 11 enforcement. All colors use var(--mj-*) tokens; zero hex literals.

## Files created
- apps/web-main/src/app/(frontend)/sla/sla.css — severity badge CSS classes (4 variants: p1 error, p2 warning, p3 info, p4 secondary)
- apps/web-main/src/app/(frontend)/sla/page.tsx — public RSC with all 6 SLA sections (uptime, recovery, severity matrix, maintenance, credits, contact)

## Key decisions
- Badge colors as CSS classes (not inline styles) to satisfy CLAUDE.md §7 CSP nonce requirement
- --mj-color-info token IS defined in layer-2-semantic-color.css (oklch(0.60 0.17 250)); fallback removed from .sla-badge--p3 — uses `var(--mj-color-info)` alone
- metadata.robots = { index: true, follow: true } for search indexing
- No tracking pixels on this page (CCPA-sensitive public page)
- async RSC function signature matches plan spec (differs from privacy/page.tsx which is sync)

## Verification
All acceptance criteria pass: 2 files present, CSS import present, no inline badge style objects (p1BadgeStyle etc. absent), zero hex literals, P1-P4 matrix with scope="col" headers, 99.9%/99.5% uptime values, RPO/RTO present, maintenance window with 02:00-04:00 UTC, robots.index=true.

## Commit
07a54d8 feat(sla): add public SLA page at /sla with P1-P4 severity matrix (Phase 12-06)

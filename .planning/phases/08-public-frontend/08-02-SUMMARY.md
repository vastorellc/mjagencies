---
plan: 08-02
phase: 08-public-frontend
title: Per-agency app scaffold — 11 apps, niche theme and font
status: complete
wave: 2
---

## Summary

Scaffolded all 11 agency Next.js apps with complete (frontend) route groups, root layouts wired to per-agency niche themes, middleware.ts using @mjagency/auth/middleware, and next.config.mjs with Payload withPayload() integration. Each app inherits the shared design-token layer from packages/ui while setting agency-specific CSS data attributes (data-agency, data-niche) for OKLCH theme resolution.

## Files created / modified
- `apps/web-ecommerce/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-growth/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-webdev/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-ai/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-branding/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-strategy/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-finance/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-engineering/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-product/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-video/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`
- `apps/web-graphic/src/app/layout.tsx` + `(frontend)/layout.tsx` + `next.config.mjs` + `middleware.ts`

## Key decisions
- (frontend) route group pattern used consistently — Payload admin at /admin is excluded from agency layouts
- Middleware matcher excludes _next, api, (payload), admin routes per CLAUDE.md §4
- Each app sets `data-agency` and `data-niche` on <html> for CSS cascade theme resolution
- Commit cb57700 `feat(08-02)`: all 11 agency app layouts delivered

## Verification
`git log --oneline -- apps/web-ecommerce/src/app/\(frontend\)/layout.tsx` shows cb57700. All 11 apps have (frontend)/layout.tsx present.

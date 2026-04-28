---
plan: 08-05
phase: 08-public-frontend
title: RUM script — web-vitals (LCP/INP/CLS/FCP/TTFB), GA4 events, CI thresholds
status: complete
wave: 3
---

## Summary

Built WebVitalsReporter component in packages/ui/src/rum/web-vitals.tsx that dynamically imports the web-vitals package and registers all 5 core metrics (LCP, INP, CLS, FCP, TTFB). Each metric fires a window.gtag() event with event_category=Web Vitals and non_interaction=true. CLS is multiplied by 1000 before sending. Component renders null (no DOM output). Also added RUM_THRESHOLDS constants for Lighthouse CI budget enforcement.

Note: In Phase 11-07 (RUM persistence), the component was extended to also emit via navigator.sendBeacon('/api/rum') for Postgres storage — this is additive, the original GA4 emit is preserved.

## Files created
- `packages/ui/src/rum/web-vitals.tsx` — WebVitalsReporter with all 5 metrics; dual-emit after Phase 11-07
- `packages/ui/src/rum/thresholds.ts` — RUM_THRESHOLDS: LCP < 2500ms desktop / < 4000ms mobile, CLS < 0.1
- `lighthouserc.json` — Lighthouse CI budget config referencing RUM_THRESHOLDS values

## Key decisions
- Dynamic import('web-vitals') avoids SSR bundle cost
- window.gtag?.() optional chain avoids errors when GA4 not loaded
- RUM_THRESHOLDS exported as typed constants so Lighthouse CI and in-code assertions share the same values

## Verification
`packages/ui/src/rum/web-vitals.tsx` exists and exports WebVitalsReporter. `packages/ui/src/rum/thresholds.ts` exports RUM_THRESHOLDS.

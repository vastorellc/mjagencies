# @mjagency/testing

Shared testing infrastructure for all MJAgency apps and packages. Ships the shared Vitest 2.x config consumed by every workspace, deterministic agency fixtures (`TEST_AGENCIES` — 12 objects with `slug`, `id`, and `port`), and the MSW base handler array that milestone-specific plans extend (Plan 01-02 adds Stripe webhook handlers, Plan 01-03 adds Cloudflare Images handlers). All test suites in the monorepo extend `packages/testing/vitest.config.ts` so coverage thresholds, reporter settings, and environment are centrally managed.

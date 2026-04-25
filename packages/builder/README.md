# @mjagency/builder

Type contracts for the Puck visual page-builder (REQ-130, REQ-131, REQ-132). M001 ships types only; M010 (Phase 10) implements:

- `<BuilderShell>` React component wrapping Puck with the admin bar, meta panel, and SEO score widget.
- Server-action save handlers gated by `BuilderAuthContext` (server-side session check per CLAUDE.md §3 + REQ-132 — auth cookie is UI-toggle only, NOT access control).
- Per-agency block whitelisting via `BuilderConfig.availableBlocks`.

Puck (`@measured/puck`) is installed at M001 so M010 doesn't churn the dependency graph; no Puck imports exist here yet.

## Hard rules carried from CLAUDE.md (Puck Builder section)

- Puck saves via server action with auth check as first line.
- Puck output is JSON; never `dangerouslySetInnerHTML`.
- Block components sanitize string inputs before rendering.

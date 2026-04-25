# @mjagency/media

Server-side-only Cloudflare + R2 + BlurHash wrappers consumed by all 12 agency apps. M001 ships type contracts and functional client factories; full upload UX (Lexical editor + DAM) lands in M005, video pipelines in M005-M008.

## Server-side invariant (REQ-304)

Every export in this package requires API tokens that MUST live in Doppler (`mjagency-shared` project; per-agency overrides per `mjagency/specs/security.md`). The factories throw if env vars are missing. NEVER import these clients from a `'use client'` component.

## AVIF variant convention

`deliveryUrl(imageId, variant)` returns `https://imagedelivery.net/<account>/<imageId>/<variant>`. The `avif` variant is auto-derived by Cloudflare's image resizing; M005 documents the variant catalog (public, avif, thumbnail, hero, og).

## R2 endpoint convention

`createR2Client` constructs the S3 client with `endpoint: https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (per Cloudflare R2 S3-compatible API). All keys MUST be prefixed `agency/<agencyId>/<asset-class>/<id>` to enforce the cache-tag invariant from `cache-tags.ts`.

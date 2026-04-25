# @mjagency/media

Cloudflare media integrations: Images API (server-side upload, AVIF delivery), Stream (video), and R2 (object storage). Exports server-side-only factory functions — never imported in Edge or browser bundles (REQ-304). Plan 01-03 fills this package with the SDK scaffolds and BlurHash integration. M005 wires it into Payload media collections. At M001 this is a typed stub with the server-only boundary enforced.

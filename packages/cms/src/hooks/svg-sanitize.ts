/**
 * packages/cms/src/hooks/svg-sanitize.ts
 *
 * Payload beforeOperation hook that sanitizes SVG uploads via DOMPurify + SVGO (REQ-305).
 *
 * Security model (CLAUDE.md §7):
 *   - DOMPurify removes script tags, event handlers, foreign objects, data: URIs
 *   - SVGO removes unnecessary attributes, normalizes structure
 *   - Runs on Node.js (jsdom for DOMPurify) — NOT Edge runtime compatible
 *   - Validates MIME type: only runs for image/svg+xml uploads
 *
 * Implementation note (Payload 3.82.1 upload pipeline):
 *   The uploaded file binary is on `args.req.file.data` (Buffer). It is NOT
 *   stored on `args.data.svgContent` — that field does not exist on media_assets.
 *   We read the Buffer, sanitize+optimize, then mutate `args.req.file.data`
 *   in place so Payload writes the sanitized bytes to disk/storage.
 *
 * DOMPurify config (restrictive):
 *   - FORBID_TAGS: ['script','object','embed','foreignObject','use']
 *   - FORBID_ATTR: ['onload','onerror','onclick','onmouseover','style']
 *   - USE_PROFILES: { svg: true, svgFilters: true }
 */
import type { CollectionBeforeOperationHook } from 'payload'

export const svgSanitizeHook: CollectionBeforeOperationHook = async ({ args, operation }) => {
  // Only run on create/update with an attached file (Payload upload-enabled collection)
  if (operation !== 'create' && operation !== 'update') return
  const file = args.req?.file as { data?: Buffer; mimetype?: string; size?: number } | undefined
  if (!file?.data || !Buffer.isBuffer(file.data)) return

  // Only process SVG uploads — Payload uses lowercase `mimetype` on req.file
  const mimeType = (file.mimetype ?? '').toLowerCase()
  if (mimeType !== 'image/svg+xml') return

  // Dynamically import heavy deps to avoid loading in non-SVG paths
  const [{ JSDOM }, DOMPurifyModule, { optimize }] = await Promise.all([
    import('jsdom'),
    import('dompurify'),
    import('svgo'),
  ])

  const svgString = file.data.toString('utf8')

  // Set up DOMPurify with jsdom (server-side — not browser DOMPurify)
  const { window } = new JSDOM('')
  const DOMPurify = DOMPurifyModule.default(window as unknown as Window)

  const sanitized = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'object', 'embed', 'foreignObject', 'use'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'style'],
    FORCE_BODY: false,
  })

  if (!sanitized || sanitized.trim() === '') {
    throw new Error('SVG sanitization failed: DOMPurify removed all content. Upload rejected (REQ-305).')
  }

  // SVGO optimization pass
  const optimized = optimize(sanitized, {
    plugins: [
      'removeDoctype', 'removeComments', 'removeMetadata',
      'removeEmptyAttrs', 'removeEmptyContainers', 'removeUnusedNS',
      'cleanupAttrs', 'mergeStyles', 'inlineStyles', 'minifyStyles',
    ],
  })

  if (!optimized.data) {
    throw new Error('SVG optimization failed: SVGO returned empty output. Upload rejected (REQ-305).')
  }

  // Write the sanitized + optimized SVG back to the upload buffer.
  // Payload reads req.file.data when persisting, so mutating in place
  // is sufficient — no need to touch args.data.
  const sanitizedBuf = Buffer.from(optimized.data, 'utf8')
  file.data = sanitizedBuf
  file.size = sanitizedBuf.byteLength
}

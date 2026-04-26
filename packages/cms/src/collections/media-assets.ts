/**
 * packages/cms/src/collections/media-assets.ts
 *
 * Payload 3.82.1 CollectionConfig for the `media_assets` collection.
 * Digital Asset Management (DAM) — images, video, SVG, documents.
 *
 * REQ-052: media_assets collection
 * REQ-060, REQ-061, REQ-062, REQ-063: DAM features
 * REQ-305: SVG sanitization (DOMPurify + SVGO) — implemented in Plan 05-05
 *
 * Fields:
 *   blur_hash        — 32-char BlurHash string computed at upload via `blurhash` npm (specs/media.md)
 *   dominant_color   — hex string from color-thief-node (specs/media.md)
 *   swatches         — top-3 hex array JSON from color-thief-node (specs/media.md)
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'
import { svgSanitizeHook } from '../hooks/svg-sanitize.js'
import { extractDominantColor, computeBlurHashFromBuffer } from '@mjagency/media'
import { createLogger } from '@mjagency/config'

const logger = createLogger({ service: 'cms.media-assets' })

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const mediaAssetsCollection: CollectionConfig = {
  slug: 'media_assets',
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'video/*', 'application/pdf', 'image/svg+xml'],
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'status', 'agency_id', 'updatedAt'],
    group: 'Media',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  hooks: {
    beforeOperation: [svgSanitizeHook],
    afterOperation: [
      async ({ args, result, operation }: {
        args: { req?: { file?: { data?: Buffer; mimetype?: string }; payload?: import('payload').Payload } }
        result: { id?: string | number } & Record<string, unknown>
        operation: string
      }) => {
        if (operation !== 'create' && operation !== 'update') return result
        const file = args.req?.file
        const payload = args.req?.payload
        if (!file?.data || !Buffer.isBuffer(file.data) || !payload || !result.id) return result

        // Skip extraction for non-bitmap (e.g. SVG, PDF) — color-thief only handles raster
        const mime = (file.mimetype ?? '').toLowerCase()
        const isBitmap = mime === 'image/jpeg' || mime === 'image/png' ||
                         mime === 'image/webp' || mime === 'image/avif'
        if (!isBitmap) return result

        try {
          // Run extraction in parallel; both produce strings stored on the row
          const [color, blurHash] = await Promise.all([
            extractDominantColor(file.data),
            // computeBlurHashFromBuffer accepts a Buffer and returns Promise<string|undefined>
            computeBlurHashFromBuffer(file.data).catch(() => undefined),
          ])

          // Persist via Payload local API — bypass access control because we
          // are completing an already-authorized create/update on the same row.
          // NOTE: collection slug is `'media_assets'` (underscore). Plan 05-02
          // defines it as such; ALL relationTo refs in 05-03c also use the
          // underscore form. The hyphenated form `'media-assets'` is the file
          // basename only and is NOT a valid collection slug — using it would
          // throw "Collection not found" at runtime and silently leave
          // dominant_color/swatches/blur_hash empty (REQ-061 regression).
          await payload.update({
            collection: 'media_assets',
            id: result.id,
            data: {
              dominant_color: color.dominantColor,
              swatches: color.swatches,
              ...(blurHash ? { blur_hash: blurHash } : {}),
            },
            overrideAccess: true,
          })
        } catch (err) {
          // Never block the upload — log and continue. Search degrades gracefully
          // for assets where extraction fails (color filter just won't match them).
          logger.warn({ err, assetId: result.id }, 'color extraction failed')
        }
        return result
      },
    ],
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'alt',
      type: 'text',
      required: true,
      minLength: 10,
      maxLength: 125,
      admin: {
        description: 'Alt text is required. Minimum 10 characters, maximum 125 characters.',
      },
    },
    {
      name: 'caption',
      type: 'textarea',
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Pending Review', value: 'pending_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Published', value: 'published' },
        { label: 'Paused', value: 'paused' },
        { label: 'Archived', value: 'archived' },
        { label: 'Deleted', value: 'deleted' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'blur_hash',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'BlurHash placeholder string — auto-generated at upload via the afterOperation hook.',
        position: 'sidebar',
      },
    },
    {
      name: 'dominant_color',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Dominant color hex — extracted at upload via color-thief-node.',
        position: 'sidebar',
      },
    },
    {
      name: 'swatches',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Top-3 color swatch hex array — extracted at upload via color-thief-node.',
      },
    },
    {
      name: 'has_captions',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'caption_language',
      type: 'text',
      defaultValue: 'en',
      admin: { position: 'sidebar' },
    },
    {
      name: 'ai_generated',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Mark if this asset was generated by AI. Enables compliance disclosure (REQ-207).',
      },
    },
    {
      name: 'permission_file',
      type: 'upload',
      relationTo: 'media_assets',
      admin: {
        description: 'Model release, usage rights, or permission documentation.',
      },
    },
  ],
}

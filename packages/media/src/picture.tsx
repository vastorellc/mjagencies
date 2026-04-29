import React from 'react'
import Image from 'next/image'
import type { ImageProps } from 'next/image'
import { decodeBlurHash } from './blurhash.js'
import type { BlurHashResult } from './types.js'

export interface MjImageProps {
  /** Cloudflare Images image ID (not a full URL) */
  cloudflareImageId: string
  /** Meaningful alt text. Pass empty string "" only for purely decorative images. */
  alt: string
  /** Intrinsic width in pixels — required to reserve layout space (REQ-095 CLS=0) */
  width: number
  /** Intrinsic height in pixels — required to reserve layout space (REQ-095 CLS=0) */
  height: number
  /** BlurHash result from DAM — enables blur-up placeholder (REQ-093) */
  blurHash?: BlurHashResult
  /**
   * Set to true for above-the-fold hero images to trigger browser preload (REQ-094 LCP).
   * Only set on ONE image per page (the LCP element).
   */
  priority?: boolean
  /**
   * Responsive sizes hint. Defaults to '100vw'.
   * Example: '(min-width: 1024px) 50vw, 100vw'
   */
  sizes?: string
  /** Additional className for the wrapping element (use var(--mj-*) tokens only in CSS) */
  className?: string
  /** Inline style — kept narrow to React.CSSProperties so consumers can pass var(--mj-*) tokens. */
  style?: React.CSSProperties
}

const CF_ACCOUNT_ID =
  process.env['CLOUDFLARE_IMAGES_ACCOUNT_ID'] ??
  process.env['NEXT_PUBLIC_CF_ACCOUNT_ID'] ??
  ''

/**
 * MjImage — canonical image component for MJAgency platform.
 *
 * Delivers images via Cloudflare Images (AVIF+WebP via next.config.mjs formats array).
 * Applies BlurHash placeholder to prevent CLS during image load.
 *
 * SECURITY: SVG bypass via Next.js Image is never enabled. All SVG must go through
 * DOMPurify+SVGO at upload time (CLAUDE.md Rule 7). Do NOT add SVG bypass props here.
 */
export function MjImage({
  cloudflareImageId,
  alt,
  width,
  height,
  blurHash,
  priority = false,
  sizes = '100vw',
  className,
  style,
}: MjImageProps): React.ReactElement {
  const src = `https://imagedelivery.net/${CF_ACCOUNT_ID}/${cloudflareImageId}/public`

  const blurProps: Pick<ImageProps, 'placeholder' | 'blurDataURL'> = blurHash
    ? {
        placeholder: 'blur',
        blurDataURL: decodeBlurHash(blurHash.hash, 32, 32),
      }
    : { placeholder: 'empty' }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      className={className}
      style={style}
      // REQ-098: SVG bypass is intentionally omitted and must never be added.
      // SVG files are sanitized at upload (DOMPurify+SVGO) before reaching Cloudflare Images.
      {...blurProps}
    />
  )
}

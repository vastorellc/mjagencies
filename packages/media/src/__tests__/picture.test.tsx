// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MjImage } from '../picture.js'

// Mock next/image to avoid Next.js server runtime in test
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height } = props
    return <img src={src as string} alt={alt as string} width={width as number} height={height as number} data-testid="mj-image" />
  },
}))

describe('MjImage', () => {
  it('renders with Cloudflare delivery URL', () => {
    const { getByTestId } = render(
      <MjImage
        cloudflareImageId="test-image-abc123"
        alt="Test hero image"
        width={1200}
        height={600}
      />
    )
    const img = getByTestId('mj-image')
    expect(img.getAttribute('src')).toContain('imagedelivery.net')
    expect(img.getAttribute('src')).toContain('test-image-abc123')
  })

  it('renders with alt text', () => {
    const { getByAltText } = render(
      <MjImage
        cloudflareImageId="test-image-abc123"
        alt="Hero image for ecommerce agency"
        width={1200}
        height={600}
      />
    )
    expect(getByAltText('Hero image for ecommerce agency')).toBeTruthy()
  })

  it('does not include SVG bypass attributes', () => {
    const { getByTestId } = render(
      <MjImage
        cloudflareImageId="test-image-abc123"
        alt="Test"
        width={100}
        height={100}
      />
    )
    // REQ-098: The rendered img element must not have any SVG-bypass attributes (never pass SVG bypass prop to next/image)
    const img = getByTestId('mj-image')
    expect(img.hasAttribute('unoptimized')).toBe(false)
    // Confirm no SVG-content-bypass attribute is present on the element
    expect(img.getAttribute('dangerously-allow-svg')).toBeNull()
  })
})

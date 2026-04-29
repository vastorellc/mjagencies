import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'MJ Ecommerce Agency'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: '#1A0C06',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#E0713A',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 16,
        }}
      >
        MJ AGENCY
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: '#FFFFFF',
          lineHeight: 1.1,
          maxWidth: 800,
        }}
      >
        More revenue from the traffic you already have.
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 24,
          color: 'rgba(255,255,255,0.65)',
          maxWidth: 680,
          lineHeight: 1.5,
        }}
      >
        Shopify development, conversion optimization, and paid acquisition for high-growth brands.
      </div>
    </div>,
    { ...size }
  )
}

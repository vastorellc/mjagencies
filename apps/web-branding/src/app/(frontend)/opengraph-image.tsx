import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'MJ Branding Agency'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: '#0A0A0A',
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
          color: '#888888',
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
        Brand identity that gets remembered.
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 24,
          color: 'rgba(255,255,255,0.60)',
          maxWidth: 680,
          lineHeight: 1.5,
        }}
      >
        Strategy, naming, visual identity, and brand systems for companies that mean it.
      </div>
    </div>,
    { ...size }
  )
}

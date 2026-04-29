import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#121212',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        fontFamily: 'sans-serif',
        fontWeight: 700,
        fontSize: 14,
        color: '#FFFFFF',
        letterSpacing: '-0.02em',
      }}
    >
      MJ
    </div>,
    { ...size }
  )
}

import React from 'react'
import type { VideoHeroProps } from './types.js'

export const VideoHero: React.FC<VideoHeroProps> = ({
  videoUrl,
  posterUrl,
  posterAlt,
  headline,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--video-hero ${className}`}
    style={{
      position: 'relative',
      minHeight: '60vh',
      overflow: 'hidden',
      backgroundColor: 'var(--mj-color-surface)',
    }}
  >
    <video
      src={videoUrl}
      poster={posterUrl}
      aria-label={posterAlt}
      muted={true}
      loop={true}
      autoPlay={true}
      playsInline={true}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'var(--mj-color-bg)',
        opacity: 0.4,
      }}
    />
    {headline !== undefined && (
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 'var(--mj-space-16)',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--mj-font-heading)',
            fontSize: 'var(--mj-text-5xl)',
            color: 'var(--mj-color-bg)',
            margin: 0,
            maxWidth: '800px',
          }}
        >
          {headline}
        </h1>
      </div>
    )}
  </section>
)

export default VideoHero

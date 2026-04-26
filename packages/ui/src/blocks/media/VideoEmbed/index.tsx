'use client'
import React, { useState } from 'react'
import type { VideoEmbedProps } from './types.js'

function getEmbedSrc(platform: 'youtube' | 'vimeo', videoId: string): string {
  if (platform === 'youtube') {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1`
  }
  return `https://player.vimeo.com/video/${videoId}?autoplay=1`
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({
  videoId,
  platform,
  posterUrl,
  posterAlt,
  title,
  className = '',
}): React.ReactElement => {
  const [loaded, setLoaded] = useState(false)

  if (!loaded) {
    return (
      <div
        className={`mj-block mj-block--video-embed ${className}`}
        onClick={() => setLoaded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setLoaded(true)
          }
        }}
        aria-label={`Play video: ${title}`}
        style={{
          position: 'relative',
          cursor: 'pointer',
          borderRadius: 'var(--mj-radius-md)',
          overflow: 'hidden',
          aspectRatio: '16 / 9',
          backgroundColor: 'var(--mj-color-surface)',
        }}
      >
        <img
          src={posterUrl}
          alt={posterAlt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          loading="lazy"
          decoding="async"
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              width: 'var(--mj-space-16)',
              height: 'var(--mj-space-16)',
              borderRadius: 'var(--mj-radius-full)',
              backgroundColor: 'var(--mj-color-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              style={{ marginLeft: '4px' }}
            >
              <path d="M8 5v14l11-7z" fill="currentColor" style={{ color: 'var(--mj-color-brand-primary)' }} />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`mj-block mj-block--video-embed ${className}`}
      style={{
        position: 'relative',
        borderRadius: 'var(--mj-radius-md)',
        overflow: 'hidden',
        aspectRatio: '16 / 9',
        backgroundColor: 'var(--mj-color-surface)',
      }}
    >
      <iframe
        src={getEmbedSrc(platform, videoId)}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />
    </div>
  )
}

export default VideoEmbed

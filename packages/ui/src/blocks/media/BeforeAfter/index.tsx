'use client'
import React, { useState, useRef, useCallback } from 'react'
import type { BeforeAfterProps } from './types.js'

export const BeforeAfter: React.FC<BeforeAfterProps> = ({
  beforeUrl,
  beforeAlt,
  afterUrl,
  afterAlt,
  headline,
  className = '',
}): React.ReactElement => {
  const [position, setPosition] = useState<number>(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const updatePosition = useCallback((clientX: number): void => {
    const container = containerRef.current
    if (container === null) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const newPosition = Math.min(100, Math.max(0, (x / rect.width) * 100))
    setPosition(newPosition)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    isDragging.current = true
    updatePosition(e.clientX)
  }, [updatePosition])

  const handleMouseMove = useCallback((e: React.MouseEvent): void => {
    if (!isDragging.current) return
    updatePosition(e.clientX)
  }, [updatePosition])

  const handleMouseUp = useCallback((): void => {
    isDragging.current = false
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent): void => {
    const touch = e.touches[0]
    if (touch !== undefined) {
      updatePosition(touch.clientX)
    }
  }, [updatePosition])

  return (
    <section className={`mj-block mj-block--before-after ${className}`}>
      {headline !== undefined && (
        <h2
          style={{
            fontFamily: 'var(--mj-font-heading)',
            fontSize: 'var(--mj-text-2xl)',
            color: 'var(--mj-color-text-primary)',
            margin: '0 0 var(--mj-space-6)',
            textAlign: 'center',
          }}
        >
          {headline}
        </h2>
      )}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--mj-radius-md)',
          cursor: 'ew-resize',
          userSelect: 'none',
          aspectRatio: '16 / 9',
        }}
      >
        {/* Before image (full width baseline) */}
        <img
          src={beforeUrl}
          alt={beforeAlt}
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* After image (clipped by slider position) */}
        <img
          src={afterUrl}
          alt={afterAlt}
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            clipPath: `inset(0 0 0 ${position}%)`,
          }}
        />

        {/* Labels */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 'var(--mj-space-3)',
            left: 'var(--mj-space-3)',
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-xs)',
            fontWeight: 700,
            padding: 'var(--mj-space-1) var(--mj-space-2)',
            backgroundColor: 'var(--mj-color-bg)',
            color: 'var(--mj-color-text-primary)',
            borderRadius: 'var(--mj-radius-sm)',
            opacity: position > 10 ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        >
          Before
        </span>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 'var(--mj-space-3)',
            right: 'var(--mj-space-3)',
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-xs)',
            fontWeight: 700,
            padding: 'var(--mj-space-1) var(--mj-space-2)',
            backgroundColor: 'var(--mj-color-bg)',
            color: 'var(--mj-color-text-primary)',
            borderRadius: 'var(--mj-radius-sm)',
            opacity: position < 90 ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        >
          After
        </span>

        {/* Divider bar */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${position}%`,
            transform: 'translateX(-50%)',
            width: '4px',
            backgroundColor: 'var(--mj-color-bg)',
            pointerEvents: 'none',
          }}
        >
          {/* Handle circle */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'var(--mj-space-8)',
              height: 'var(--mj-space-8)',
              borderRadius: 'var(--mj-radius-full)',
              backgroundColor: 'var(--mj-color-bg)',
              border: '2px solid var(--mj-color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5 8l-3 3V5l3 3zm6 0l3 3V5l-3 3z" fill="currentColor" style={{ color: 'var(--mj-color-text-secondary)' }} />
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--mj-color-border)' }} />
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BeforeAfter

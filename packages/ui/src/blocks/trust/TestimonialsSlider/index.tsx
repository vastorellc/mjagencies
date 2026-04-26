'use client'
import React, { useState } from 'react'
import type { TestimonialsSliderProps } from './types.js'

export const TestimonialsSlider: React.FC<TestimonialsSliderProps> = ({
  testimonials,
  disclaimer,
  className = '',
}): React.ReactElement => {
  const [currentIndex, setCurrentIndex] = useState(0)

  const handlePrev = (): void => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1))
  }

  const handleNext = (): void => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1))
  }

  const testimonial = testimonials[currentIndex]

  if (testimonials.length === 0) {
    return <section className={`mj-block mj-block--testimonials-slider ${className}`} />
  }

  return (
    <section className={`mj-block mj-block--testimonials-slider ${className}`}>
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--mj-color-surface)',
          borderRadius: 'var(--mj-radius-lg)',
          padding: 'var(--mj-space-12) var(--mj-space-16)',
          border: '1px solid var(--mj-color-border)',
          textAlign: 'center',
          minHeight: '240px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--mj-space-6)',
        }}
      >
        <blockquote
          style={{
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--mj-space-5)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-xl)',
              color: 'var(--mj-color-text-primary)',
              fontStyle: 'italic',
              lineHeight: 1.7,
              margin: 0,
              maxWidth: '700px',
            }}
          >
            &ldquo;{testimonial?.quote}&rdquo;
          </p>
          <footer style={{ display: 'flex', alignItems: 'center', gap: 'var(--mj-space-3)' }}>
            {testimonial?.avatarUrl !== undefined && (
              <img
                src={testimonial.avatarUrl}
                alt={testimonial.avatarAlt ?? testimonial.author}
                style={{
                  width: 'var(--mj-space-12)',
                  height: 'var(--mj-space-12)',
                  borderRadius: 'var(--mj-radius-full)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ textAlign: 'left' }}>
              <cite
                style={{
                  fontFamily: 'var(--mj-font-body)',
                  fontSize: 'var(--mj-text-base)',
                  fontWeight: 700,
                  color: 'var(--mj-color-text-primary)',
                  fontStyle: 'normal',
                  display: 'block',
                }}
              >
                {testimonial?.author}
              </cite>
              {(testimonial?.role !== undefined || testimonial?.company !== undefined) && (
                <span
                  style={{
                    fontFamily: 'var(--mj-font-body)',
                    fontSize: 'var(--mj-text-sm)',
                    color: 'var(--mj-color-text-secondary)',
                  }}
                >
                  {[testimonial?.role, testimonial?.company].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </footer>
        </blockquote>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mj-space-4)' }}>
          <button
            onClick={handlePrev}
            aria-label="Previous testimonial"
            style={{
              background: 'none',
              border: '1px solid var(--mj-color-border)',
              borderRadius: 'var(--mj-radius-full)',
              width: 'var(--mj-space-10)',
              height: 'var(--mj-space-10)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mj-color-text-primary)',
              fontSize: 'var(--mj-text-lg)',
            }}
          >
            {'‹'}
          </button>
          <span
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-sm)',
              color: 'var(--mj-color-text-secondary)',
            }}
          >
            {currentIndex + 1} / {testimonials.length}
          </span>
          <button
            onClick={handleNext}
            aria-label="Next testimonial"
            style={{
              background: 'none',
              border: '1px solid var(--mj-color-border)',
              borderRadius: 'var(--mj-radius-full)',
              width: 'var(--mj-space-10)',
              height: 'var(--mj-space-10)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mj-color-text-primary)',
              fontSize: 'var(--mj-text-lg)',
            }}
          >
            {'›'}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 'var(--mj-text-xs)', color: 'var(--mj-color-text-secondary)' }}>
        {disclaimer}
      </p>
    </section>
  )
}

export default TestimonialsSlider

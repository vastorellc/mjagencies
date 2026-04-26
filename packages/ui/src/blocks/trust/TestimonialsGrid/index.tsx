import React from 'react'
import type { TestimonialsGridProps } from './types.js'

export const TestimonialsGrid: React.FC<TestimonialsGridProps> = ({
  testimonials,
  disclaimer,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--testimonials-grid ${className}`}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 'var(--mj-space-6)',
        marginBottom: 'var(--mj-space-6)',
      }}
    >
      {testimonials.map((testimonial, index) => (
        <blockquote
          key={index}
          style={{
            margin: 0,
            padding: 'var(--mj-space-8)',
            backgroundColor: 'var(--mj-color-surface)',
            borderRadius: 'var(--mj-radius-md)',
            border: '1px solid var(--mj-color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mj-space-5)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-lg)',
              color: 'var(--mj-color-text-primary)',
              fontStyle: 'italic',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            &ldquo;{testimonial.quote}&rdquo;
          </p>
          <footer
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--mj-space-3)',
            }}
          >
            {testimonial.avatarUrl !== undefined && (
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
            <div>
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
                {testimonial.author}
              </cite>
              {(testimonial.role !== undefined || testimonial.company !== undefined) && (
                <span
                  style={{
                    fontFamily: 'var(--mj-font-body)',
                    fontSize: 'var(--mj-text-sm)',
                    color: 'var(--mj-color-text-secondary)',
                  }}
                >
                  {[testimonial.role, testimonial.company].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </footer>
        </blockquote>
      ))}
    </div>
    <p style={{ fontSize: 'var(--mj-text-xs)', color: 'var(--mj-color-text-secondary)' }}>
      {disclaimer}
    </p>
  </section>
)

export default TestimonialsGrid

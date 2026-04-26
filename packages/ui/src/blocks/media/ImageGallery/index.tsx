import React from 'react'
import type { ImageGalleryProps } from './types.js'

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  columns = 3,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--image-gallery ${className}`}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--mj-space-4)',
      }}
    >
      {images.map((image, index) => (
        <figure
          key={index}
          style={{ margin: 0, borderRadius: 'var(--mj-radius-md)', overflow: 'hidden' }}
        >
          <img
            src={image.url}
            alt={image.alt}
            style={{
              width: '100%',
              height: '240px',
              objectFit: 'cover',
              display: 'block',
            }}
            loading="lazy"
            decoding="async"
          />
          {image.caption !== undefined && (
            <figcaption
              style={{
                fontFamily: 'var(--mj-font-body)',
                fontSize: 'var(--mj-text-xs)',
                color: 'var(--mj-color-text-secondary)',
                padding: 'var(--mj-space-2) var(--mj-space-3)',
                backgroundColor: 'var(--mj-color-surface)',
              }}
            >
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  </section>
)

export default ImageGallery

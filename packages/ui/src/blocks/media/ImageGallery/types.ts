export interface GalleryImage {
  url: string
  alt: string
  caption?: string
  blurHash?: string
}

export interface ImageGalleryProps {
  images: GalleryImage[]
  columns?: 2 | 3 | 4
  className?: string
}

export interface VideoEmbedProps {
  videoId: string
  platform: 'youtube' | 'vimeo'
  posterUrl: string
  posterAlt: string
  title: string
  className?: string
}

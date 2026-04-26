import type React from 'react'

export interface ServiceDetailProps {
  title: string
  description: React.ReactNode
  iconUrl?: string
  iconAlt?: string
  features: string[]
  ctaText?: string
  ctaHref?: string
  className?: string
}

export const AGENCIES = [
  'brand',
  'ecommerce',
  'growth',
  'webdev',
  'ai',
  'branding',
  'strategy',
  'finance',
  'engineering',
  'product',
  'video',
  'graphic',
] as const

export type AgencySlug = (typeof AGENCIES)[number]

export const AGENCY_PORTS: Record<AgencySlug, number> = {
  brand: 3000,
  ecommerce: 3001,
  growth: 3002,
  webdev: 3003,
  ai: 3004,
  branding: 3005,
  strategy: 3006,
  finance: 3007,
  engineering: 3008,
  product: 3009,
  video: 3010,
  graphic: 3011,
}

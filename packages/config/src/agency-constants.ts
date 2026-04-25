// Agency slugs in canonical order (port 3000 = brand/main, 3001-3011 = agency apps)
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

export const AGENCY_PORT_BASE = 3000

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

// Agency-isolation Redis/BullMQ key helpers (CLAUDE.md §8, RESEARCH pitfall 3.9)
export const REDIS_KEY = {
  cache: (a: string, k: string) => `agency:${a}:cache:${k}`,
  session: (a: string, u: string) => `agency:${a}:session:${u}`,
  bullPrefix: (a: string) => `agency:${a}:bull`,
  rateLimit: (a: string, ip: string) => `agency:${a}:ratelimit:${ip}`,
} as const

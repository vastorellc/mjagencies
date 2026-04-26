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
  cache:     (a: string, k: string)  => `agency:${a}:cache:${k}`,
  bullPrefix:(a: string)             => `agency:${a}:bull`,
  rateLimit: (a: string, ip: string) => `agency:${a}:ratelimit:${ip}`,
  // session.* — per-agency. SSO is cross-agency and lives in `accounts.*` below.
  session: {
    user:       (a: string, u: string)   => `agency:${a}:session:${u}`,        // back-compat alias for the previous session() signature
    rt:         (a: string, jti: string) => `agency:${a}:session:rt:${jti}`,
    family:     (a: string, f: string)   => `agency:${a}:session:family:${f}`,
    revoked:    (a: string, jti: string) => `agency:${a}:session:revoked:${jti}`,
    mfaLockout: (a: string, u: string)   => `agency:${a}:session:mfa-lockout:${u}`,
  },
  // Cross-agency, platform-shared. SSO codes brokered through accounts.brand.com (Plan 03-03, Q2).
  accounts: {
    sso: {
      code: (codeId: string) => `accounts:sso:code:${codeId}`,
    },
  },
} as const

/**
 * Reserved UUID for non-user audit operations (migrations, cron, system actions).
 * Used as `actor_id` in audit_log rows where no authenticated user is present.
 * Open Q4 resolution per Plan 02-06.
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001' as const

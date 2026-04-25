// Deterministic UUIDv4 per agency slug (fixed seeds for reproducible test data)
const AGENCY_UUIDS: Record<string, string> = {
  brand: 'a1b2c3d4-0001-4000-8000-000000000001',
  ecommerce: 'a1b2c3d4-0002-4000-8000-000000000002',
  growth: 'a1b2c3d4-0003-4000-8000-000000000003',
  webdev: 'a1b2c3d4-0004-4000-8000-000000000004',
  ai: 'a1b2c3d4-0005-4000-8000-000000000005',
  branding: 'a1b2c3d4-0006-4000-8000-000000000006',
  strategy: 'a1b2c3d4-0007-4000-8000-000000000007',
  finance: 'a1b2c3d4-0008-4000-8000-000000000008',
  engineering: 'a1b2c3d4-0009-4000-8000-000000000009',
  product: 'a1b2c3d4-0010-4000-8000-000000000010',
  video: 'a1b2c3d4-0011-4000-8000-000000000011',
  graphic: 'a1b2c3d4-0012-4000-8000-000000000012',
}

export interface AgencyFixture {
  slug: string
  id: string
  port: number
}

export const TEST_AGENCIES: AgencyFixture[] = [
  { slug: 'brand', id: AGENCY_UUIDS['brand']!, port: 3000 },
  { slug: 'ecommerce', id: AGENCY_UUIDS['ecommerce']!, port: 3001 },
  { slug: 'growth', id: AGENCY_UUIDS['growth']!, port: 3002 },
  { slug: 'webdev', id: AGENCY_UUIDS['webdev']!, port: 3003 },
  { slug: 'ai', id: AGENCY_UUIDS['ai']!, port: 3004 },
  { slug: 'branding', id: AGENCY_UUIDS['branding']!, port: 3005 },
  { slug: 'strategy', id: AGENCY_UUIDS['strategy']!, port: 3006 },
  { slug: 'finance', id: AGENCY_UUIDS['finance']!, port: 3007 },
  { slug: 'engineering', id: AGENCY_UUIDS['engineering']!, port: 3008 },
  { slug: 'product', id: AGENCY_UUIDS['product']!, port: 3009 },
  { slug: 'video', id: AGENCY_UUIDS['video']!, port: 3010 },
  { slug: 'graphic', id: AGENCY_UUIDS['graphic']!, port: 3011 },
]

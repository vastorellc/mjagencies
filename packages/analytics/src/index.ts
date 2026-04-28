export { sendServerEvent } from './ga4-server.js'
export type { GA4ServerEventInput } from './ga4-server.js'
export { runReport } from './ga4-data-api.js'
export type { GA4ReportRequest, GA4ReportRow } from './ga4-data-api.js'
export { GA4InjectScript } from './ga4-script.js'

// Plan 11-02: Microsoft Clarity heatmaps + session recordings (REQ-141)
export { ClarityInit, emitClarityEvent } from './clarity-init.js'
export type { ClarityInitProps } from './clarity-init.js'
export { ClarityInjectScript } from './clarity-script.js'
export type { ClarityInjectScriptProps } from './clarity-script.js'
export { clarityDeleteUser } from './clarity-delete.js'
export type { ClarityDeleteResult } from './clarity-delete.js'

// Plan 11-04: Dashboard data layer (REQ-143) — GA4 + Postgres + RUM hybrid
export * from './dashboard/index.js'

// Plan 11-03 browser-side companion: Meta Pixel client script (REQ-142)
export { MetaPixelScript } from './meta-pixel.js'
export type { } from './meta-pixel.js'

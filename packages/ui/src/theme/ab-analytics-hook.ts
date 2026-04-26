// packages/ui/src/theme/ab-analytics-hook.ts
// M004: noop. M009: replaced by real GA4 + Meta CAPI adapters (Phase 11).
import type { AbVariant } from './ab-types.js';

export interface AbAnalyticsAdapter {
  /** Called when a visitor is assigned to a variant */
  onAssign(agencyId: string, variant: AbVariant, experimentId?: string): void;
  /** Called on conversion event */
  onConvert(agencyId: string, variant: AbVariant, eventName: string, value?: number): void;
}

export const noopAbAdapter: AbAnalyticsAdapter = {
  onAssign:  () => void 0,
  onConvert: () => void 0,
};

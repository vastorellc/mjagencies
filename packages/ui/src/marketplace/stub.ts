// packages/ui/src/marketplace/stub.ts
// Theme marketplace no-op stub — Plan 04-05 (M004 types-only).
// list() returns an empty page so UI can render a zero-state gracefully.
// get/install/publish throw with a clear M010 message to prevent silent misuse.
import type { ThemeMarketplaceService, ThemeMarketplacePage } from './types.js';

const M010_NOT_IMPLEMENTED = 'Theme marketplace not implemented (M010 builder phase). Plan 04-05 ships types-only.';

export const marketplaceStub: ThemeMarketplaceService = {
  list:    async (): Promise<ThemeMarketplacePage> => ({ items: [], total: 0, page: 1, per_page: 20 }),
  get:     async (id) => { throw new Error(`${M010_NOT_IMPLEMENTED} Requested id: ${id}`); },
  install: async (agencyId) => { throw new Error(`${M010_NOT_IMPLEMENTED} agencyId: ${agencyId}`); },
  publish: async (agencyId) => { throw new Error(`${M010_NOT_IMPLEMENTED} agencyId: ${agencyId}`); },
};

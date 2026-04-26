// packages/ui/src/__tests__/marketplace-stub.test.ts
// TDD tests for marketplace stub — Plan 04-05 Task 5.1
// Types-only at M004; real implementation deferred to M010.

import { describe, it, expect } from 'vitest';
import { marketplaceStub } from '../marketplace/stub.js';

describe('marketplaceStub', () => {
  it('list returns empty page with correct shape', async () => {
    const result = await marketplaceStub.list({});
    expect(result).toEqual({ items: [], total: 0, page: 1, per_page: 20 });
  });

  it('list with query params still returns empty page', async () => {
    const result = await marketplaceStub.list({ niche: 'ai', page: 2, per_page: 10 });
    expect(result).toEqual({ items: [], total: 0, page: 1, per_page: 20 });
  });

  it('get throws with M010 message', async () => {
    await expect(marketplaceStub.get('theme-001')).rejects.toThrow(/M010/);
  });

  it('install throws with M010 message', async () => {
    await expect(marketplaceStub.install('agency-x', 'theme-001')).rejects.toThrow(/M010/);
  });

  it('publish throws with M010 message', async () => {
    await expect(
      marketplaceStub.publish('agency-x', 'theme-001', { name: 'My Theme' }),
    ).rejects.toThrow(/M010/);
  });
});

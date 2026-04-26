// packages/ui/src/marketplace/types.ts
// Theme marketplace types — Plan 04-05 (types-only at M004).
// Full implementation deferred to M010 builder phase via tRPC.
// REQ-048 (Storybook proves marketplace types compile); M010 implements the service.
import type { ThemeJson } from '../theme/types.js';

export interface MarketplaceTheme {
  id:            string;
  slug:          string;
  name:          string;
  description:   string;
  niche:         string;
  preview_url:   string;
  thumbnail_url: string;
  author:        string;
  license:       'mit' | 'commercial';
  version:       string;
  downloads:     number;
  rating:        number;    // 0-5
  theme_json:    ThemeJson;
  created_at:    string;
  updated_at:    string;
}

export interface ThemeMarketplaceQuery {
  niche?:    string;
  search?:   string;
  sort?:     'popular' | 'recent' | 'rating';
  page?:     number;
  per_page?: number;
}

export interface ThemeMarketplacePage {
  items:    MarketplaceTheme[];
  total:    number;
  page:     number;
  per_page: number;
}

/** M004: stub only. Real implementation in M010 via tRPC. */
export interface ThemeMarketplaceService {
  list(query: ThemeMarketplaceQuery): Promise<ThemeMarketplacePage>;
  get(id: string): Promise<MarketplaceTheme>;
  install(agencyId: string, marketplaceThemeId: string): Promise<void>;
  publish(agencyId: string, themeId: string, meta: Partial<MarketplaceTheme>): Promise<MarketplaceTheme>;
}

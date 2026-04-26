// packages/ui/src/theme/ab-types.ts
// A/B experiment framework types — Plan 04-05 (types-only at M004).
// Phase 9 (REQ-080..086): real GA4 adapter replaces noopAbAdapter.
// Phase 11: edge-cookie deterministic assignment replaces assignVariant Math.random path.
// REQ-044 (12 niche themes are the variant A pool); REQ-048 (Storybook proves both variants).

export type AbVariant = 'a' | 'b';

export interface AbAssignment {
  agencyId:     string;
  variant:      AbVariant;
  assignedAt:   string;       // ISO timestamp
  experimentId?: string;      // GA4 experiment ID; M009+ populates this
}

export interface AbExperimentConfig {
  experimentId: string;
  agencyId:     string;
  variantA:     unknown;      // theme.json or theme ID; full type in Phase 5
  variantB:     unknown;
  trafficSplit: number;       // 0-100, percentage routed to variant B
  status:       'active' | 'paused' | 'completed';
}

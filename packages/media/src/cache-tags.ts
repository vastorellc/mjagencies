/** REQ-091 ISR cache-tag convention. Per CLAUDE.md §8 (agency isolation). */
export function agencyAssetCacheTag(agencyId: string, assetId: string): string {
  return `agency:${agencyId}:asset:${assetId}`
}

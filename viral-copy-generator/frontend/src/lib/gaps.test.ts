import { describe, it, expect } from 'vitest'
import { buildGapAnalysis } from './gaps'
import type { ChecklistItem } from './types'

function failItem(id: string, category: ChecklistItem['category'], fix: string): ChecklistItem {
  return { id, category, label: id, status: 'fail', fix }
}
function passItem(id: string, category: ChecklistItem['category']): ChecklistItem {
  return { id, category, label: id, status: 'pass', fix: '' }
}
function pendingItem(id: string, category: ChecklistItem['category']): ChecklistItem {
  return { id, category, label: id, status: 'pending', fix: '' }
}

describe('buildGapAnalysis', () => {
  it('returns empty when checklist is empty', () => {
    expect(buildGapAnalysis([])).toEqual([])
  })

  it('returns empty when no failures', () => {
    const out = buildGapAnalysis([
      passItem('a', 'video-technical'),
      pendingItem('b', 'metadata-quality'),
    ])
    expect(out).toEqual([])
  })

  it('returns only fix messages from failed items', () => {
    const out = buildGapAnalysis([
      failItem('a', 'video-technical', 'fix A'),
      passItem('b', 'video-technical'),
      failItem('c', 'virality-boosters', 'fix C'),
    ])
    expect(out).toEqual(['fix A', 'fix C'])
  })

  it('skips items with empty fix (info-only)', () => {
    const out = buildGapAnalysis([
      failItem('a', 'video-technical', 'fix A'),
      // empty fix — should be skipped even if status=fail (defensive)
      { id: 'b', category: 'video-technical', label: 'b', status: 'fail', fix: '' },
    ])
    expect(out).toEqual(['fix A'])
  })

  it('skips metadata-quality items (always pending)', () => {
    // defensive: even if a metadata-quality item somehow has fail status, it should not surface
    const out = buildGapAnalysis([
      failItem('meta', 'metadata-quality', 'should be excluded'),
      failItem('vt', 'video-technical', 'should appear'),
    ])
    expect(out).toEqual(['should appear'])
  })

  it('skips pass items even when they carry a non-empty fix string (defensive)', () => {
    const out = buildGapAnalysis([
      { id: 'a', category: 'video-technical', label: 'a', status: 'pass', fix: 'should not appear' },
      failItem('b', 'video-technical', 'should appear'),
    ])
    expect(out).toEqual(['should appear'])
  })

  it('orders groups: Video Technical -> Virality Boosters -> Niche-Pakistan', () => {
    const out = buildGapAnalysis([
      failItem('niche', 'niche-pakistan', 'NICHE'),
      failItem('virality', 'virality-boosters', 'VIRALITY'),
      failItem('video', 'video-technical', 'VIDEO'),
    ])
    expect(out).toEqual(['VIDEO', 'VIRALITY', 'NICHE'])
  })

  it('preserves insertion order within a category', () => {
    const out = buildGapAnalysis([
      failItem('vt1', 'video-technical', 'VT1'),
      failItem('vt2', 'video-technical', 'VT2'),
      failItem('vt3', 'video-technical', 'VT3'),
    ])
    expect(out).toEqual(['VT1', 'VT2', 'VT3'])
  })

  it('combines correct ordering across all three categories', () => {
    const out = buildGapAnalysis([
      failItem('niche2', 'niche-pakistan', 'N2'),
      failItem('vt1', 'video-technical', 'V1'),
      failItem('vb1', 'virality-boosters', 'B1'),
      failItem('niche1', 'niche-pakistan', 'N1'),
      failItem('vt2', 'video-technical', 'V2'),
      failItem('vb2', 'virality-boosters', 'B2'),
    ])
    expect(out).toEqual(['V1', 'V2', 'B1', 'B2', 'N2', 'N1'])
  })
})

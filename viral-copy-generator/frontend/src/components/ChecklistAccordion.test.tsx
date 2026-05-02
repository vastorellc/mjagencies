import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChecklistAccordion from './ChecklistAccordion'
import type { ChecklistItem } from '../lib/types'

function pass(id: string, category: ChecklistItem['category'], label = id): ChecklistItem {
  return { id, category, label, status: 'pass', fix: '' }
}
function fail(id: string, category: ChecklistItem['category'], fix: string, label = id): ChecklistItem {
  return { id, category, label, status: 'fail', fix }
}
function pending(id: string, category: ChecklistItem['category'], label = id): ChecklistItem {
  return { id, category, label, status: 'pending', fix: '' }
}

const sampleItems: ChecklistItem[] = [
  // 5 video-technical (3 pass + 2 fail)
  pass('aspect_ratio_vertical', 'video-technical'),
  fail('duration_in_band', 'video-technical', 'Length is 5.0s; short-form sweet spot is 10-90s.'),
  pass('has_audio', 'video-technical'),
  fail('brightness_healthy', 'video-technical', 'Brightness is 0.85; aim for 0.3-0.7.'),
  pass('resolution_min', 'video-technical'),
  // 8 metadata-quality (all pending)
  pending('caption_length_youtube', 'metadata-quality'),
  pending('caption_length_instagram', 'metadata-quality'),
  pending('caption_length_tiktok', 'metadata-quality'),
  pending('hashtag_count_in_band', 'metadata-quality'),
  pending('hook_in_first_line', 'metadata-quality'),
  pending('cta_present', 'metadata-quality'),
  pending('language_match_niche', 'metadata-quality'),
  pending('description_keyword_density', 'metadata-quality'),
  // 5 virality-boosters (2 pass + 1 fail + 2 pending)
  pass('strong_hook', 'virality-boosters'),
  pass('multiple_scene_cuts', 'virality-boosters'),
  fail('motion_present', 'virality-boosters', 'Motion score is 0.05.'),
  pending('beat_aligned_audio', 'virality-boosters'),
  pending('no_long_silence', 'virality-boosters'),
  // 3 niche-pakistan (all pass)
  pass('vertical_for_reels_shorts', 'niche-pakistan'),
  pass('no_face_niche_ok', 'niche-pakistan'),
  pass('pkt_posting_window_hint', 'niche-pakistan'),
]

describe('ChecklistAccordion', () => {
  it('renders 4 section headers in order', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    expect(screen.getByTestId('checklist-section-video-technical')).toBeInTheDocument()
    expect(screen.getByTestId('checklist-section-metadata-quality')).toBeInTheDocument()
    expect(screen.getByTestId('checklist-section-virality-boosters')).toBeInTheDocument()
    expect(screen.getByTestId('checklist-section-niche-pakistan')).toBeInTheDocument()
  })

  it('default expansion: video-technical + virality-boosters open; metadata + niche closed', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    expect(screen.getByTestId('checklist-section-video-technical').getAttribute('data-open')).toBe('true')
    expect(screen.getByTestId('checklist-section-virality-boosters').getAttribute('data-open')).toBe('true')
    expect(screen.getByTestId('checklist-section-metadata-quality').getAttribute('data-open')).toBe('false')
    expect(screen.getByTestId('checklist-section-niche-pakistan').getAttribute('data-open')).toBe('false')
  })

  it('toggles section open/closed on header click', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    const toggle = screen.getByTestId('checklist-section-toggle-metadata-quality')
    expect(screen.getByTestId('checklist-section-metadata-quality').getAttribute('data-open')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByTestId('checklist-section-metadata-quality').getAttribute('data-open')).toBe('true')
    fireEvent.click(toggle)
    expect(screen.getByTestId('checklist-section-metadata-quality').getAttribute('data-open')).toBe('false')
  })

  it('section header summary: "(3/5 passed)" for video-technical (3 pass + 2 fail)', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    const header = screen.getByTestId('checklist-section-toggle-video-technical')
    expect(header.textContent).toContain('(3/5 passed)')
  })

  it('section header summary: "(8 pending)" for metadata-quality (all pending)', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    const header = screen.getByTestId('checklist-section-toggle-metadata-quality')
    expect(header.textContent).toContain('(8 pending)')
  })

  it('section header summary: virality-boosters "(2/3 passed)" (2 pass + 1 fail + 2 pending)', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    const header = screen.getByTestId('checklist-section-toggle-virality-boosters')
    expect(header.textContent).toContain('(2/3 passed)')
  })

  it('renders fix message inline beneath failed items', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    const failedItem = screen.getByTestId('checklist-item-duration_in_band')
    expect(failedItem.textContent).toContain('Length is 5.0s')
  })

  it('does not render fix message for passing items', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    const passingItem = screen.getByTestId('checklist-item-aspect_ratio_vertical')
    expect(passingItem.textContent).not.toContain('Length is')
    expect(passingItem.textContent).not.toContain('Brightness is')
  })

  it('uses correct status icons (✓ ✗ …)', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    const passItem = screen.getByTestId('checklist-item-aspect_ratio_vertical')
    expect(passItem.textContent).toContain('✓')
    const failItem = screen.getByTestId('checklist-item-duration_in_band')
    expect(failItem.textContent).toContain('✗')
    fireEvent.click(screen.getByTestId('checklist-section-toggle-metadata-quality'))
    const pendingItem = screen.getByTestId('checklist-item-caption_length_youtube')
    expect(pendingItem.textContent).toContain('…')
  })

  it('items hidden when section is collapsed', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    expect(screen.queryByTestId('checklist-item-caption_length_youtube')).toBeNull()
    fireEvent.click(screen.getByTestId('checklist-section-toggle-metadata-quality'))
    expect(screen.queryByTestId('checklist-item-caption_length_youtube')).not.toBeNull()
  })

  it('attaches data-status to each item row for testability', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    expect(screen.getByTestId('checklist-item-aspect_ratio_vertical').getAttribute('data-status')).toBe('pass')
    expect(screen.getByTestId('checklist-item-duration_in_band').getAttribute('data-status')).toBe('fail')
  })

  it('niche-pakistan section shows all items when opened', () => {
    render(<ChecklistAccordion items={sampleItems} />)
    fireEvent.click(screen.getByTestId('checklist-section-toggle-niche-pakistan'))
    expect(screen.getByTestId('checklist-item-vertical_for_reels_shorts')).toBeInTheDocument()
    expect(screen.getByTestId('checklist-item-no_face_niche_ok')).toBeInTheDocument()
    expect(screen.getByTestId('checklist-item-pkt_posting_window_hint')).toBeInTheDocument()
  })
})

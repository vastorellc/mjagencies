// Wave 0 stub — tests go GREEN when PlatformCopyCard.tsx is implemented in Plan 05-05.
// Covers: PLATFORM-03 (copy button), PLATFORM-06 (TikTok upload disabled), PLATFORM-09 (upload states)
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// Import will fail RED until Plan 05-05 creates PlatformCopyCard.tsx
import PlatformCopyCard from './PlatformCopyCard'
import type { AIOutput, UploadStatus } from '../lib/types'

const MOCK_OUTPUT: AIOutput = {
  youtube: { title: 'Test Title', description: 'Test desc', tags: ['tag1', 'tag2'], hook: 'Hook!' },
  instagram: { caption: 'Insta cap', hashtags: ['#travel'], cover_text: 'Cover' },
  tiktok: { hook: 'TikHook', caption: 'Tik cap', hashtags: ['#tik'] },
  facebook: { caption: 'FB cap', cta: 'Click now', hashtags: ['#fb'] },
  x: { tweet: 'Tweet text', hashtags: ['#x'] },
  script_outline: 'Outline',
}

describe('PlatformCopyCard — copy button (PLATFORM-03)', () => {
  it('copy button calls navigator.clipboard.writeText with field text', async () => {
    const clipboardSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboardSpy }, configurable: true })

    render(
      <PlatformCopyCard
        platform="youtube"
        aiOutput={MOCK_OUTPUT}
        uploadStatus="idle"
        onUpload={vi.fn()}
      />
    )

    const copyBtn = screen.getAllByRole('button', { name: /copy title/i })[0]
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledWith('Test Title')
    })
  })

  it('copy button shows "Copied!" text for 1.5s after click', async () => {
    vi.useFakeTimers()
    const clipboardSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboardSpy }, configurable: true })

    render(
      <PlatformCopyCard
        platform="youtube"
        aiOutput={MOCK_OUTPUT}
        uploadStatus="idle"
        onUpload={vi.fn()}
      />
    )

    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    await act(async () => { fireEvent.click(copyBtns[0]) })
    expect(screen.getByText('Copied!')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1600) })
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('PlatformCopyCard — TikTok upload disabled (PLATFORM-06)', () => {
  it('TikTok upload button is always disabled with correct label', () => {
    render(
      <PlatformCopyCard
        platform="tiktok"
        aiOutput={MOCK_OUTPUT}
        uploadStatus="idle"
        onUpload={vi.fn()}
      />
    )
    const uploadBtn = screen.getByText(/available once api approved/i)
    expect(uploadBtn).toBeDisabled()
  })
})

describe('PlatformCopyCard — X card has no upload button (PLATFORM-08)', () => {
  it('X card does not render an upload button', () => {
    render(
      <PlatformCopyCard
        platform="x"
        aiOutput={MOCK_OUTPUT}
        uploadStatus="idle"
        onUpload={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument()
  })
})

describe('PlatformCopyCard — upload status states (PLATFORM-09)', () => {
  const stateCases: Array<[UploadStatus, string]> = [
    ['idle', 'Upload'],
    ['uploading', 'Uploading'],
    ['posted', 'Posted'],
    ['failed', 'Retry Upload'],
  ]

  for (const [status, expectedLabel] of stateCases) {
    it(`renders "${expectedLabel}" label for uploadStatus="${status}"`, () => {
      render(
        <PlatformCopyCard
          platform="youtube"
          aiOutput={MOCK_OUTPUT}
          uploadStatus={status}
          onUpload={vi.fn()}
        />
      )
      expect(screen.getByText(new RegExp(expectedLabel, 'i'))).toBeInTheDocument()
    })
  }

  it('upload button is disabled when uploading', () => {
    render(
      <PlatformCopyCard
        platform="youtube"
        aiOutput={MOCK_OUTPUT}
        uploadStatus="uploading"
        onUpload={vi.fn()}
      />
    )
    // The uploading button should not be clickable (disabled or cursor-not-allowed)
    const btn = screen.getByText(/uploading/i).closest('button')
    expect(btn).toBeDisabled()
  })
})

describe('PlatformCopyCard — data-testid attributes', () => {
  it('renders data-testid="platform-copy-card-youtube" on YouTube card', () => {
    render(
      <PlatformCopyCard
        platform="youtube"
        aiOutput={MOCK_OUTPUT}
        uploadStatus="idle"
        onUpload={vi.fn()}
      />
    )
    expect(screen.getByTestId('platform-copy-card-youtube')).toBeInTheDocument()
  })
})

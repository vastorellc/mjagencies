import { useState } from 'react'
import type { AIOutput, Platform, UploadStatus } from '../lib/types'

// ============================================================================
// Per-platform static class strings — FULL strings only (no template literals).
// Tailwind 4 JIT tree-shakes dynamic class names. Same pattern as BAND_CLASSES in ScorePanel.tsx.
// ============================================================================
const PLATFORM_WRAPPER_CLASSES: Record<Platform, string> = {
  youtube:   'rounded-lg border-2 border-red-500 bg-red-950 p-4 flex flex-col gap-3',
  instagram: 'rounded-lg border-2 border-pink-500 bg-pink-950 p-4 flex flex-col gap-3',
  tiktok:    'rounded-lg border-2 border-cyan-400 bg-zinc-900 p-4 flex flex-col gap-3',
  facebook:  'rounded-lg border-2 border-blue-500 bg-blue-950 p-4 flex flex-col gap-3',
  x:         'rounded-lg border-2 border-zinc-400 bg-zinc-900 p-4 flex flex-col gap-3',
}

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube:   'YouTube Shorts',
  instagram: 'Instagram Reels',
  tiktok:    'TikTok',
  facebook:  'Facebook Reels',
  x:         'X / Twitter',
}

// Upload button states — full static strings only
const UPLOAD_BUTTON_CLASSES: Record<UploadStatus, string> = {
  idle:      'rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-600',
  uploading: 'rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-400 cursor-not-allowed flex items-center gap-1',
  posted:    'rounded bg-green-800 px-3 py-1 text-xs text-green-200 cursor-default',
  failed:    'rounded bg-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-800',
}

const UPLOAD_BUTTON_LABELS: Record<UploadStatus, string> = {
  idle:      'Upload',
  uploading: 'Uploading…',
  posted:    'Posted ✓',
  failed:    'Retry Upload',
}

interface Props {
  platform: Platform
  aiOutput: AIOutput
  uploadStatus: UploadStatus
  onUpload: () => void
}

export default function PlatformCopyCard({ platform, aiOutput, uploadStatus, onUpload }: Props) {
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  async function handleCopy(fieldId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(prev => ({ ...prev, [fieldId]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [fieldId]: false })), 1500)
    } catch {
      // clipboard.writeText fails silently on non-HTTPS or blocked permission
    }
  }

  const platformLabel = PLATFORM_LABELS[platform]

  function CopyBtn({ fieldId, text, label }: { fieldId: string; text: string; label: string }) {
    const isCopied = copied[fieldId] ?? false
    return (
      <button
        type="button"
        onClick={() => { void handleCopy(fieldId, text) }}
        aria-label={isCopied ? `Copied ${label} for ${platformLabel}` : `Copy ${label} for ${platformLabel}`}
        className={
          isCopied
            ? 'rounded bg-zinc-700 px-2 py-1 text-xs text-green-400 hover:bg-zinc-600 min-h-[32px]'
            : 'rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 min-h-[32px]'
        }
      >
        {isCopied ? 'Copied!' : 'Copy'}
      </button>
    )
  }

  function FieldRow({ fieldId, label, text, limit }: { fieldId: string; label: string; text: string; limit?: number }) {
    const overLimit = limit !== undefined && text.length > limit
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">{label}</span>
          <div className="flex items-center gap-2">
            {limit !== undefined && (
              <span className={overLimit ? 'text-xs text-red-400' : 'text-xs text-zinc-500'}>
                {text.length}/{limit}
              </span>
            )}
            <CopyBtn fieldId={fieldId} text={text} label={label} />
          </div>
        </div>
        <p className="text-sm text-zinc-100 whitespace-pre-wrap">{text}</p>
      </div>
    )
  }

  function HashtagRow({ fieldId, label, hashtags }: { fieldId: string; label: string; hashtags: string[] }) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{hashtags.length} tags</span>
            <CopyBtn fieldId={fieldId} text={hashtags.join(' ')} label={label} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {hashtags.map((tag, i) => (
            <span key={i} className="rounded bg-zinc-800 px-2 py-1 text-xs">{tag}</span>
          ))}
        </div>
      </div>
    )
  }

  function UploadBtn() {
    if (platform === 'x') return null
    if (platform === 'tiktok') {
      return (
        <button
          type="button"
          disabled
          title="TikTok API approval pending"
          aria-label="TikTok upload not available — pending API approval"
          className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-500 cursor-not-allowed"
        >
          Available once API approved
        </button>
      )
    }
    const ariaLabels: Record<UploadStatus, string> = {
      idle:      `Upload to ${platformLabel}`,
      uploading: `Uploading to ${platformLabel}`,
      posted:    `Posted to ${platformLabel}`,
      failed:    `Upload to ${platformLabel} failed — click to retry`,
    }
    return (
      <button
        type="button"
        disabled={uploadStatus === 'uploading' || uploadStatus === 'posted'}
        onClick={uploadStatus === 'idle' || uploadStatus === 'failed' ? onUpload : undefined}
        aria-label={ariaLabels[uploadStatus]}
        className={UPLOAD_BUTTON_CLASSES[uploadStatus]}
      >
        {uploadStatus === 'uploading' && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        {UPLOAD_BUTTON_LABELS[uploadStatus]}
      </button>
    )
  }

  return (
    <div
      data-testid={`platform-copy-card-${platform}`}
      data-platform={platform}
      className={PLATFORM_WRAPPER_CLASSES[platform]}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">{platformLabel}</span>
        <UploadBtn />
      </div>

      <hr className="border-zinc-700" />

      {platform === 'youtube' && (
        <>
          {aiOutput.youtube.hook && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Hook</span>
              <p className="text-sm text-zinc-400 italic">{aiOutput.youtube.hook}</p>
            </div>
          )}
          <hr className="border-zinc-700" />
          <FieldRow fieldId="youtube-title" label="Title" text={aiOutput.youtube.title} limit={60} />
          <hr className="border-zinc-700" />
          <FieldRow fieldId="youtube-description" label="Description" text={aiOutput.youtube.description} limit={150} />
          <hr className="border-zinc-700" />
          <HashtagRow fieldId="youtube-tags" label="Tags" hashtags={aiOutput.youtube.tags} />
        </>
      )}

      {platform === 'instagram' && (
        <>
          {aiOutput.instagram.cover_text && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Cover Text</span>
              <p className="text-sm text-zinc-400 italic">{aiOutput.instagram.cover_text}</p>
            </div>
          )}
          <hr className="border-zinc-700" />
          <FieldRow fieldId="instagram-caption" label="Caption" text={aiOutput.instagram.caption} limit={200} />
          <hr className="border-zinc-700" />
          <HashtagRow fieldId="instagram-hashtags" label="Hashtags" hashtags={aiOutput.instagram.hashtags} />
        </>
      )}

      {platform === 'tiktok' && (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Hook</span>
              <CopyBtn fieldId="tiktok-hook" text={aiOutput.tiktok.hook} label="Hook" />
            </div>
            <p className="text-base font-bold text-white whitespace-pre-wrap">{aiOutput.tiktok.hook}</p>
          </div>
          <hr className="border-zinc-700" />
          <FieldRow fieldId="tiktok-caption" label="Caption" text={aiOutput.tiktok.caption} limit={150} />
          <hr className="border-zinc-700" />
          <HashtagRow fieldId="tiktok-hashtags" label="Hashtags" hashtags={aiOutput.tiktok.hashtags} />
        </>
      )}

      {platform === 'facebook' && (
        <>
          <FieldRow fieldId="facebook-caption" label="Caption" text={aiOutput.facebook.caption} />
          <hr className="border-zinc-700" />
          <FieldRow fieldId="facebook-cta" label="Call to Action" text={aiOutput.facebook.cta} />
          <hr className="border-zinc-700" />
          <HashtagRow fieldId="facebook-hashtags" label="Hashtags" hashtags={aiOutput.facebook.hashtags} />
        </>
      )}

      {platform === 'x' && (
        <>
          <FieldRow fieldId="x-tweet" label="Tweet" text={aiOutput.x.tweet} limit={280} />
          <hr className="border-zinc-700" />
          <HashtagRow fieldId="x-hashtags" label="Hashtags" hashtags={aiOutput.x.hashtags} />
        </>
      )}
    </div>
  )
}

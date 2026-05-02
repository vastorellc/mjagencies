import { useState } from 'react'
import type { ChecklistItem, ChecklistCategory, ChecklistStatus } from '../lib/types'

interface Props {
  items: ChecklistItem[]
}

interface SectionMeta {
  category: ChecklistCategory
  label: string
  defaultExpanded: boolean
}

const SECTIONS: SectionMeta[] = [
  { category: 'video-technical',   label: 'Video Technical',   defaultExpanded: true  },
  { category: 'metadata-quality',  label: 'Metadata Quality',  defaultExpanded: false },
  { category: 'virality-boosters', label: 'Virality Boosters', defaultExpanded: true  },
  { category: 'niche-pakistan',    label: 'Niche-Pakistan',    defaultExpanded: false },
]

const ICON: Record<ChecklistStatus, string> = {
  pass:    '✓',
  fail:    '✗',
  pending: '…',
}

const ICON_COLOR: Record<ChecklistStatus, string> = {
  pass:    'text-green-500',
  fail:    'text-red-500',
  pending: 'text-zinc-500',
}

function summarise(group: ChecklistItem[]): string {
  const allPending = group.every((i) => i.status === 'pending')
  if (allPending && group.length > 0) {
    return `(${group.length} pending)`
  }
  const evaluable = group.filter((i) => i.status !== 'pending')
  const passed = evaluable.filter((i) => i.status === 'pass').length
  return `(${passed}/${evaluable.length} passed)`
}

export default function ChecklistAccordion({ items }: Props) {
  const [expanded, setExpanded] = useState<Record<ChecklistCategory, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const s of SECTIONS) init[s.category] = s.defaultExpanded
    return init as Record<ChecklistCategory, boolean>
  })

  function toggle(cat: ChecklistCategory): void {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <div data-testid="checklist-accordion" className="flex flex-col gap-2">
      {SECTIONS.map((section) => {
        const group = items.filter((i) => i.category === section.category)
        const isOpen = expanded[section.category]
        return (
          <div
            key={section.category}
            data-testid={`checklist-section-${section.category}`}
            data-open={isOpen ? 'true' : 'false'}
            className="rounded bg-zinc-900"
          >
            <button
              type="button"
              onClick={() => toggle(section.category)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold hover:bg-zinc-800"
              data-testid={`checklist-section-toggle-${section.category}`}
            >
              <span>
                {section.label}{' '}
                <span className="ml-2 text-xs font-normal text-zinc-400">{summarise(group)}</span>
              </span>
              <span className="text-xs text-zinc-400">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <ul className="flex flex-col gap-1 px-3 pb-3">
                {group.map((item) => (
                  <li
                    key={item.id}
                    data-testid={`checklist-item-${item.id}`}
                    data-status={item.status}
                    className="flex flex-col gap-0.5 py-1"
                  >
                    <div className="flex items-start gap-2 text-sm">
                      <span className={`font-bold ${ICON_COLOR[item.status]}`} aria-hidden="true">
                        {ICON[item.status]}
                      </span>
                      <span className="flex-1 text-zinc-200">{item.label}</span>
                    </div>
                    {item.status === 'fail' && item.fix && (
                      <div className="ml-6 text-xs text-zinc-500">{item.fix}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

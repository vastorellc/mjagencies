interface Props {
  gaps: string[]
}

export default function GapAnalysisPanel({ gaps }: Props) {
  if (gaps.length === 0) return null

  return (
    <section
      data-testid="gap-analysis-panel"
      className="rounded bg-zinc-900 px-4 py-3"
    >
      <h3 className="mb-2 text-sm font-bold text-zinc-200">
        Fix this to boost your score:
      </h3>
      <ol className="ml-5 list-decimal space-y-1 text-sm text-zinc-300">
        {gaps.map((gap, idx) => (
          <li key={idx} data-testid={`gap-item-${idx}`}>
            {gap}
          </li>
        ))}
      </ol>
    </section>
  )
}

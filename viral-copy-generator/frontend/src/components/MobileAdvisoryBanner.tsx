export default function MobileAdvisoryBanner() {
  return (
    <div
      className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-2 text-xs text-amber-200"
      data-testid="mobile-advisory"
    >
      Best on desktop — analysis uses significant memory and CPU.
    </div>
  )
}

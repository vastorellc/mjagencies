export async function fetchTrace(
  traceId: string,
  opts?: { tempoUrl?: string },
): Promise<{ batches: unknown[] } | null> {
  const url = `${opts?.tempoUrl ?? 'http://localhost:3200'}/api/traces/${traceId}`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json() as Promise<{ batches: unknown[] }>
}

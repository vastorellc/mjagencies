/**
 * apps/web-education/src/app/(frontend)/proposals/[token]/page.tsx
 *
 * Public proposal route — no authentication required to VIEW.
 * Records every view with: SHA-256(X-Forwarded-For IP), geo_city, geo_state, user-agent.
 * Sign/decline actions require HMAC-signed form tokens (timingSafeEqual verification).
 * REQ-125: hosted page with view tracking.
 */
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createHash, createHmac } from 'crypto'

const AGENCY_SLUG = 'education'
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''
const PROPOSAL_HMAC_SECRET = process.env['PROPOSAL_HMAC_SECRET'] ?? ''

interface ProposalPageProps {
  params: Promise<{ token: string }>
}

/** Compute HMAC-signed form token for sign/decline buttons */
function computeFormToken(token: string): string {
  return createHmac('sha256', PROPOSAL_HMAC_SECRET).update(token).digest('hex')
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { token } = await params
  const headersList = await headers()

  // Fetch proposal by token
  const proposalRes = await fetch(
    `${PAYLOAD_URL}/api/proposals?where[token][equals]=${token}&limit=1`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` }, cache: 'no-store' },
  )
  const proposalData = await proposalRes.json() as {
    docs: Array<{
      id: string
      title: string
      body_json: { text?: string }
      agency_id: string
      status: string
      expires_at?: string
    }>
  }

  if (!proposalData.docs.length) {
    notFound()
  }

  const proposal = proposalData.docs[0]!

  // Guard: proposal must belong to this agency
  if (proposal.agency_id !== AGENCY_SLUG) {
    notFound()
  }

  // Record proposal view — SHA-256 hash of IP (raw IP never stored)
  const rawIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ipHash = createHash('sha256').update(rawIp).digest('hex')
  // Geo city/state from Cloudflare headers
  const geoCity = headersList.get('cf-ipcity') ?? null
  const geoState = headersList.get('cf-ipcountry') ?? null
  const userAgent = headersList.get('user-agent') ?? null

  // Upsert view record (fire-and-forget — do not block page render on write failure)
  void fetch(`${PAYLOAD_URL}/api/proposal_views`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify({
      proposal_id: proposal.id,
      agency_id: AGENCY_SLUG,
      ip_hash: ipHash,
      user_agent: userAgent,
      geo_city: geoCity,
      geo_state: geoState,
      viewed_at: new Date().toISOString(),
    }),
  }).catch(() => { /* non-fatal — view tracking failure does not break proposal render */ })

  // Update proposal status to 'viewed' if still active
  if (proposal.status === 'active') {
    void fetch(`${PAYLOAD_URL}/api/proposals/${proposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
      body: JSON.stringify({ status: 'viewed' }),
    }).catch(() => { /* non-fatal */ })
  }

  // Generate HMAC-signed form tokens for sign/decline buttons
  const formToken = computeFormToken(token)

  const isExpired = proposal.status === 'expired' || proposal.status === 'grace' || proposal.status === 'nurture'

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--mj-space-8) var(--mj-space-4)' }}>
      <h1 style={{
        fontSize: 'var(--mj-text-size-3xl)',
        fontWeight: 'var(--mj-weight-bold)',
        lineHeight: 'var(--mj-leading-tight)',
        marginBottom: 'var(--mj-space-6)',
      }}>
        {proposal.title}
      </h1>

      {/* Proposal body content */}
      <div style={{ marginBottom: 'var(--mj-space-12)', fontSize: 'var(--mj-text-size-base)', lineHeight: 'var(--mj-leading-relaxed)' }}>
        {proposal.body_json?.text ?? ''}
      </div>

      {/* Status / action section */}
      {isExpired ? (
        <div
          role="status"
          style={{
            background: 'var(--mj-color-bg-secondary)',
            padding: 'var(--mj-space-6)',
            borderRadius: '8px',
            fontSize: 'var(--mj-text-size-base)',
            color: 'var(--mj-color-text-secondary)',
          }}
        >
          This Proposal Has Expired. Contact us to request an extension.
        </div>
      ) : proposal.status === 'signed' ? (
        <div role="status" style={{ color: 'var(--mj-color-success)', fontSize: 'var(--mj-text-size-base)', fontWeight: 'var(--mj-weight-bold)' }}>
          Signed — Thank you for your signature.
        </div>
      ) : proposal.status === 'declined' ? (
        <div role="status" style={{ color: 'var(--mj-color-error)', fontSize: 'var(--mj-text-size-base)' }}>
          You declined this proposal. Contact us if you changed your mind.
        </div>
      ) : (
        /* Sign and Decline forms — HMAC-signed tokens included */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mj-space-4)' }}>
          {/* Sign form */}
          <form method="POST" action={`/api/proposals/sign`} style={{ display: 'inline' }}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="hmacSignature" value={formToken} />
            <button
              type="submit"
              style={{
                padding: 'var(--mj-space-4) var(--mj-space-8)',
                background: 'var(--mj-color-brand-500)',
                color: 'var(--mj-color-text-on-brand)',
                fontSize: 'var(--mj-text-size-base)',
                fontWeight: 'var(--mj-weight-bold)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              Sign &amp; Accept This Proposal
            </button>
          </form>

          {/* Decline form — two-step: clicking shows inline confirmation card */}
          <details style={{ marginTop: 'var(--mj-space-2)' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 'var(--mj-text-size-sm)',
                color: 'var(--mj-color-text-secondary)',
                userSelect: 'none',
              }}
            >
              Decline this proposal
            </summary>
            {/* Inline confirmation card — requires explicit second click (two-step decline) */}
            <div
              style={{
                marginTop: 'var(--mj-space-4)',
                background: 'var(--mj-color-bg-secondary)',
                border: '1px solid var(--mj-color-border)',
                borderRadius: '8px',
                padding: 'var(--mj-space-6)',
              }}
            >
              <p style={{ fontSize: 'var(--mj-text-size-base)', marginBottom: 'var(--mj-space-4)' }}>
                Are you sure you want to decline this proposal? This action cannot be undone.
              </p>
              <form method="POST" action={`/api/proposals/decline`} style={{ display: 'inline' }}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="hmacSignature" value={formToken} />
                <button
                  type="submit"
                  style={{
                    padding: 'var(--mj-space-4) var(--mj-space-8)',
                    background: 'var(--mj-color-error)',
                    color: 'var(--mj-color-text-on-error, #fff)',
                    fontSize: 'var(--mj-text-size-base)',
                    fontWeight: 'var(--mj-weight-bold)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  Yes, Decline This Proposal
                </button>
              </form>
            </div>
          </details>
        </div>
      )}
    </main>
  )
}

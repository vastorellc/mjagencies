/**
 * apps/web-main/src/app/(frontend)/sla/page.tsx
 * Plan 12-06 — Public SLA page at /sla.
 *
 * Server component — pure copy + token-driven styles. Zero hex literals.
 * Severity badge colors use CSS classes (sla.css) per CLAUDE.md §7 CSP nonce compliance.
 * Phase 11 CSP enforcement blocks uninonce'd inline styles; stylesheet classes are nonce-exempt.
 */
import type { Metadata } from 'next'
import './sla.css'

export const metadata: Metadata = {
  title: 'Service Level Agreement · MJAgency',
  description:
    'MJAgency uptime commitments, incident severity matrix, recovery objectives, and maintenance windows for all agency deployments.',
  robots: { index: true, follow: true },
}

const pageStyle: React.CSSProperties = {
  maxWidth: 'var(--mj-container-md)',
  margin: '0 auto',
  padding: 'var(--mj-space-16) var(--mj-space-6) var(--mj-space-12)',
  color: 'var(--mj-color-text-primary)',
}

const h1Style: React.CSSProperties = { fontSize: '36px', fontWeight: 700, margin: 0 }
const updatedStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--mj-color-text-secondary)',
  margin: 0,
  marginBottom: 'var(--mj-space-8)',
}
const tocStyle: React.CSSProperties = {
  background: 'var(--mj-color-bg-secondary)',
  borderRadius: 'var(--mj-radius-lg)',
  padding: 'var(--mj-space-6)',
  marginBottom: 'var(--mj-space-12)',
}
const h2Style: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  margin: 0,
  marginTop: 'var(--mj-space-12)',
  marginBottom: 'var(--mj-space-3)',
  scrollMarginTop: 'var(--mj-space-16)',
}
const pStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: 1.5,
  margin: 0,
  marginBottom: 'var(--mj-space-3)',
}
const listStyle: React.CSSProperties = {
  paddingLeft: 'var(--mj-space-6)',
  margin: 0,
  marginBottom: 'var(--mj-space-4)',
}
const linkStyle: React.CSSProperties = {
  color: 'var(--mj-color-text-link)',
  textDecoration: 'none',
}

const statsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--mj-space-8)',
  flexWrap: 'wrap',
  marginBottom: 'var(--mj-space-6)',
}
const statCardStyle: React.CSSProperties = { flex: '1', minWidth: '200px' }
const statValueStyle: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: 700,
  color: 'var(--mj-color-text-primary)',
  margin: 0,
}
const statLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--mj-color-text-secondary)',
  margin: 0,
}
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  borderRadius: 'var(--mj-radius-lg)',
  overflow: 'hidden',
  border: '1px solid var(--mj-color-border-default)',
}
const thStyle: React.CSSProperties = {
  background: 'var(--mj-color-bg-secondary)',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--mj-color-text-secondary)',
  padding: 'var(--mj-space-3) var(--mj-space-4)',
  textAlign: 'left',
}
const tdStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 400,
  padding: 'var(--mj-space-3) var(--mj-space-4)',
  borderTop: '1px solid var(--mj-color-border-default)',
}
const dlStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: 'var(--mj-space-2) var(--mj-space-6)',
  margin: 0,
}
const dtStyle: React.CSSProperties = { fontWeight: 700, fontSize: '16px' }
const ddStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '16px',
  color: 'var(--mj-color-text-secondary)',
}

export default async function SlaPage(): Promise<React.ReactElement> {
  return (
    <main id="main-content" style={pageStyle}>
      <h1 style={h1Style}>Service Level Agreement</h1>
      <p style={updatedStyle}>Effective date: April 28, 2026</p>

      {/* Table of Contents */}
      <nav aria-label="On this page" style={tocStyle}>
        <strong>On this page</strong>
        <ol style={listStyle}>
          <li><a href="#uptime" style={linkStyle}>Uptime Commitment</a></li>
          <li><a href="#recovery" style={linkStyle}>Recovery Objectives</a></li>
          <li><a href="#severity" style={linkStyle}>Incident Severity Matrix</a></li>
          <li><a href="#maintenance" style={linkStyle}>Maintenance Windows</a></li>
          <li><a href="#credits" style={linkStyle}>Service Credits</a></li>
          <li><a href="#contact" style={linkStyle}>Contact + Escalation</a></li>
        </ol>
      </nav>

      {/* Section 1: Uptime */}
      <h2 id="uptime" style={h2Style}>Uptime Commitment</h2>
      <p style={pStyle}>MJAgency commits to the following uptime and recovery targets for all agency deployments.</p>
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <p style={statValueStyle}>99.9%</p>
          <p style={statLabelStyle}>Public site — 4.38 hours max downtime/year</p>
        </div>
        <div style={statCardStyle}>
          <p style={statValueStyle}>99.5%</p>
          <p style={statLabelStyle}>Admin dashboard — 43.8 hours max downtime/year</p>
        </div>
      </div>

      {/* Section 2: Recovery Objectives */}
      <h2 id="recovery" style={h2Style}>Recovery Objectives</h2>
      <dl style={dlStyle}>
        <dt style={dtStyle}>RPO (Recovery Point Objective)</dt>
        <dd style={ddStyle}>1 hour — maximum data loss window</dd>
        <dt style={dtStyle}>RTO (Recovery Time Objective)</dt>
        <dd style={ddStyle}>4 hours — maximum restoration time</dd>
      </dl>

      {/* Section 3: Severity Matrix */}
      <h2 id="severity" style={h2Style}>Incident Severity Matrix</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th scope="col" style={thStyle}>Severity</th>
            <th scope="col" style={thStyle}>Definition</th>
            <th scope="col" style={thStyle}>Response SLA</th>
            <th scope="col" style={thStyle}>Resolution SLA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}><span className="sla-badge sla-badge--p1">P1 Critical</span></td>
            <td style={tdStyle}>Any service fully unavailable for paying customers</td>
            <td style={tdStyle}>5 minutes</td>
            <td style={tdStyle}>1 hour</td>
          </tr>
          <tr>
            <td style={tdStyle}><span className="sla-badge sla-badge--p2">P2 High</span></td>
            <td style={tdStyle}>Significant feature degradation affecting multiple agencies</td>
            <td style={tdStyle}>15 minutes</td>
            <td style={tdStyle}>4 hours</td>
          </tr>
          <tr>
            <td style={tdStyle}><span className="sla-badge sla-badge--p3">P3 Medium</span></td>
            <td style={tdStyle}>Minor feature unavailable, workaround exists</td>
            <td style={tdStyle}>1 hour</td>
            <td style={tdStyle}>24 hours</td>
          </tr>
          <tr>
            <td style={tdStyle}><span className="sla-badge sla-badge--p4">P4 Low</span></td>
            <td style={tdStyle}>Cosmetic issues, documentation errors, feature requests</td>
            <td style={tdStyle}>Next business day</td>
            <td style={tdStyle}>72 hours</td>
          </tr>
        </tbody>
      </table>

      {/* Section 4: Maintenance Windows */}
      <h2 id="maintenance" style={h2Style}>Maintenance Windows</h2>
      <p style={pStyle}>Scheduled maintenance occurs Sundays between 02:00–04:00 UTC. We notify customers at least 48 hours before any scheduled maintenance via <a href="https://status.mjagency.com" style={linkStyle}>status.mjagency.com</a>.</p>

      {/* Section 5: Service Credits */}
      <h2 id="credits" style={h2Style}>Service Credits</h2>
      <dl style={dlStyle}>
        <dt style={dtStyle}>Uptime 99.0% – 99.89%</dt>
        <dd style={ddStyle}>10% service credit for affected month</dd>
        <dt style={dtStyle}>Uptime 95.0% – 98.99%</dt>
        <dd style={ddStyle}>25% service credit for affected month</dd>
        <dt style={dtStyle}>Uptime below 95.0%</dt>
        <dd style={ddStyle}>50% service credit for affected month</dd>
      </dl>
      <p style={pStyle}>Credits are applied to next billing cycle. Maximum 50% credit per calendar month.</p>

      {/* Section 6: Contact + Escalation */}
      <h2 id="contact" style={h2Style}>Contact + Escalation</h2>
      <p style={pStyle}>P1/P2 incidents: <a href="mailto:ops@mjagency.com" style={linkStyle}>ops@mjagency.com</a></p>
      <p style={pStyle}>P3/P4 issues: <a href="mailto:support@mjagency.com" style={linkStyle}>support@mjagency.com</a></p>
      <p style={pStyle}>Status page: <a href="https://status.mjagency.com" style={linkStyle}>status.mjagency.com</a></p>
    </main>
  )
}

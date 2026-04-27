/**
 * packages/email/src/dns-validate.ts
 *
 * DNS validation helpers for DKIM, SPF, and DMARC setup verification.
 * Used by the email setup wizard (REQ-112) to confirm DNS configuration
 * before enabling bulk sending.
 *
 * Uses Node.js built-in dns.promises — no external DNS library.
 * REQ-112 (DKIM/SPF/DMARC validation), REQ-414 (email setup wizard)
 */
import { promises as dns } from 'dns'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-email-dns' })

export interface DnsValidationResult {
  valid: boolean
  record?: string
  error?: string
}

/**
 * Validate DKIM DNS record for a domain.
 * Checks for TXT record at `default._domainkey.{domain}`.
 * Returns valid=true if any TXT record starting with 'v=DKIM1' exists.
 */
export async function validateDkim(domain: string): Promise<DnsValidationResult> {
  const selector = 'default'
  const dkimDomain = `${selector}._domainkey.${domain}`
  try {
    const records = await dns.resolveTxt(dkimDomain)
    const dkimRecord = records.flat().find((r) => r.startsWith('v=DKIM1'))
    if (dkimRecord) {
      return { valid: true, record: dkimRecord }
    }
    const flat = records.map((r) => r.join('')).join(' ')
    log.warn({ domain, dkimDomain, flat }, 'DKIM TXT record found but no v=DKIM1 token')
    return { valid: false, error: `TXT record at ${dkimDomain} does not contain v=DKIM1` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn({ domain, dkimDomain, err: message }, 'DKIM DNS lookup failed')
    return { valid: false, error: `DNS lookup failed: ${message}` }
  }
}

/**
 * Validate SPF DNS record for a domain.
 * Checks TXT records at root domain for one starting with 'v=spf1'.
 */
export async function validateSpf(domain: string): Promise<DnsValidationResult> {
  try {
    const records = await dns.resolveTxt(domain)
    const spfRecord = records.flat().find((r) => r.toLowerCase().startsWith('v=spf1'))
    if (spfRecord) {
      return { valid: true, record: spfRecord }
    }
    return { valid: false, error: `No SPF (v=spf1) TXT record found at ${domain}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn({ domain, err: message }, 'SPF DNS lookup failed')
    return { valid: false, error: `DNS lookup failed: ${message}` }
  }
}

/**
 * Validate DMARC DNS record for a domain.
 * Checks TXT record at `_dmarc.{domain}` for 'v=DMARC1'.
 */
export async function validateDmarc(domain: string): Promise<DnsValidationResult> {
  const dmarcDomain = `_dmarc.${domain}`
  try {
    const records = await dns.resolveTxt(dmarcDomain)
    const dmarcRecord = records.flat().find((r) => r.startsWith('v=DMARC1'))
    if (dmarcRecord) {
      return { valid: true, record: dmarcRecord }
    }
    return { valid: false, error: `No DMARC (v=DMARC1) TXT record found at ${dmarcDomain}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn({ domain: dmarcDomain, err: message }, 'DMARC DNS lookup failed')
    return { valid: false, error: `DNS lookup failed: ${message}` }
  }
}

/**
 * Validate all three DNS records for a domain at once.
 * Returns a summary useful for the setup wizard UI.
 */
export async function validateEmailDns(domain: string): Promise<{
  dkim: DnsValidationResult
  spf: DnsValidationResult
  dmarc: DnsValidationResult
  allValid: boolean
}> {
  const [dkim, spf, dmarc] = await Promise.all([
    validateDkim(domain),
    validateSpf(domain),
    validateDmarc(domain),
  ])
  return { dkim, spf, dmarc, allValid: dkim.valid && spf.valid && dmarc.valid }
}

/**
 * packages/esign/src/components/EsignDisclosure.tsx
 * REQ-422: ESIGN Act federal disclosure text — static, always visible above signature pad.
 * UI-SPEC: disclosure rendered above signature pad, visible without scrolling.
 * Accessibility: role="note", aria-label="Electronic Signature Disclosure"
 */

export const ESIGN_DISCLOSURE_TEXT =
  "By clicking 'Sign & Accept This Proposal', you agree that your electronic signature " +
  "is the legal equivalent of your manual signature on this agreement. You consent to " +
  "be legally bound by the terms of this proposal under the Electronic Signatures in " +
  "Global and National Commerce Act (ESIGN Act, 15 U.S.C. § 7001 et seq.)."

export function EsignDisclosure() {
  return (
    <div
      role="note"
      aria-label="Electronic Signature Disclosure"
      style={{
        background: 'var(--mj-color-bg-secondary)',
        padding: 'var(--mj-space-4)',
        borderRadius: '4px',
        marginBottom: 'var(--mj-space-6)',
        fontSize: 'var(--mj-text-size-sm)',
        lineHeight: 'var(--mj-leading-normal)',
        color: 'var(--mj-color-text-secondary)',
        border: '1px solid var(--mj-color-border)',
      }}
    >
      {ESIGN_DISCLOSURE_TEXT}
    </div>
  )
}

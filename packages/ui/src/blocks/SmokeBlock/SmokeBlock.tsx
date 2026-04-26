// packages/ui/src/blocks/SmokeBlock/SmokeBlock.tsx
// M004: tiny smoke block to prove Storybook + decorator + theme.css cascade work.
// All styles reference CSS custom properties (no hex literals — CLAUDE.md Rule 9, REQ-047).
// Phase 5 (REQ-052) replaces this with the real 45-block library.
export interface SmokeBlockProps {
  headline: string;
  body:     string;
  ctaText:  string;
}

export function SmokeBlock({ headline, body, ctaText }: SmokeBlockProps): JSX.Element {
  return (
    <section style={{ background: 'var(--mj-color-bg-primary)', color: 'var(--mj-color-text-primary)', padding: 'var(--mj-space-8)' }}>
      <h1 style={{ fontFamily: 'var(--mj-font-brand)', fontSize: 'var(--mj-text-size-4xl)', fontWeight: 700 }}>{headline}</h1>
      <p style={{ fontFamily: 'var(--mj-font-body, var(--mj-font-sans))', fontSize: 'var(--mj-text-size-lg)' }}>{body}</p>
      <button style={{
        background:   'var(--mj-color-brand-500)',
        color:        'var(--mj-color-text-inverse)',
        padding:      'var(--mj-btn-padding-y) var(--mj-btn-padding-x)',
        borderRadius: 'var(--mj-btn-radius)',
        border:       'none',
        fontWeight:   'var(--mj-btn-font-weight)',
      }}>{ctaText}</button>
    </section>
  );
}

/**
 * packages/ui/src/__tests__/no-hex-literals.test.ts
 * SVG hex-literal scanner tests for assertNoHexLiterals.
 * Belt-and-suspenders: catches hex in SVG XML, style blocks, attribute values.
 * REQ-047, RESEARCH §2.3 Pitfall 7
 */
import { describe, it, expect } from 'vitest';
import { assertNoHexLiterals } from '../theme/validate-theme.js';

describe('assertNoHexLiterals', () => {
  it('Test A: SVG with hex fill is rejected', () => {
    const svg = '<svg><rect fill="#ff0000"/></svg>';
    expect(() => assertNoHexLiterals(svg, 'icon.svg')).toThrow(/#ff0000/);
  });

  it('Test B: SVG with var(--mj-ill-*) passes scanner', () => {
    const svg = '<svg><rect fill="var(--mj-ill-primary)"/></svg>';
    expect(() => assertNoHexLiterals(svg, 'icon.svg')).not.toThrow();
  });

  it('Test C: SVG with multiple hex literals reports all unique values (deduplicated)', () => {
    const svg = '<svg><rect fill="#ff0000"/><circle fill="#00ff00"/><stop stop-color="#ff0000"/></svg>';
    const call = (): void => assertNoHexLiterals(svg, 'multi.svg');
    expect(call).toThrow(/#ff0000/);
    expect(call).toThrow(/#00ff00/);
    // #ff0000 appears twice in SVG but should appear only once in error message
    let errorMessage = '';
    try {
      assertNoHexLiterals(svg, 'multi.svg');
    } catch (err) {
      errorMessage = (err as Error).message;
    }
    const ff0000Occurrences = (errorMessage.match(/#ff0000/g) ?? []).length;
    expect(ff0000Occurrences).toBe(1);
  });

  it('Test D: hex in CSS-in-style block is detected', () => {
    const svg = '<svg><style>circle { fill: #abc; }</style></svg>';
    expect(() => assertNoHexLiterals(svg, 'styled.svg')).toThrow(/#abc/);
  });

  it('Test E: empty SVG passes', () => {
    const svg = '<svg></svg>';
    expect(() => assertNoHexLiterals(svg, 'empty.svg')).not.toThrow();
  });

  it('Test F: error message includes the filename', () => {
    const svg = '<svg><rect fill="#bad123"/></svg>';
    let errorMessage = '';
    try {
      assertNoHexLiterals(svg, 'my-icon.svg');
    } catch (err) {
      errorMessage = (err as Error).message;
    }
    expect(errorMessage).toContain('my-icon.svg');
  });
});

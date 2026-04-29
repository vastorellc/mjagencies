// @vitest-environment jsdom
/**
 * Unit tests for runAxeTest — the WCAG 2.2 AA gate (REQ-096).
 *
 * Two contracts to lock in:
 *   1. accessible HTML produces zero critical violations
 *   2. broken HTML (img without alt) throws with 'critical' in the message
 *      so test runners surface the actual violation text in CI logs
 *
 * Note: axe-core requires the element under test to be attached to the
 * document tree. Each test appends a fresh div and removes it on teardown.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { runAxeTest } from '../axe-setup.js'

const created: HTMLElement[] = []

afterEach(() => {
  for (const el of created) el.remove()
  created.length = 0
})

function makeDiv(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
  created.push(div)
  return div
}

describe('runAxeTest', () => {
  it('passes for accessible HTML', async () => {
    const div = makeDiv(`
      <main id="main-content">
        <h1>Test page heading</h1>
        <nav aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
        <p>Page content with <a href="/contact">contact link</a>.</p>
        <img src="test.jpg" alt="Test image" width="100" height="100" />
        <button type="button" aria-label="Open menu">Menu</button>
      </main>
    `)

    const result = await runAxeTest(div)
    expect(result.violations.filter((v) => v.impact === 'critical')).toHaveLength(0)
  })

  it('throws for img missing alt text', async () => {
    const div = makeDiv(`<main><img src="test.jpg" width="100" height="100" /></main>`)
    await expect(runAxeTest(div)).rejects.toThrow(/critical/i)
  })
})

import axe from 'axe-core'

export interface AxeTestResult {
  violations: axe.Result[]
  passes: axe.Result[]
  incomplete: axe.Result[]
}

/**
 * Runs axe-core against a rendered HTML container and asserts zero critical violations.
 * Throws a Vitest-friendly error listing all critical violations if any are found.
 *
 * REQ-096: WCAG 2.2 AA CI gate — zero critical violations = ship condition.
 *
 * @param container - The HTMLElement to scan (typically from @testing-library/react `render`)
 * @returns Full axe results for additional assertions
 */
export async function runAxeTest(container: HTMLElement): Promise<AxeTestResult> {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
    },
  })

  const critical = results.violations.filter(v => v.impact === 'critical')

  if (critical.length > 0) {
    const details = critical
      .map(v => `  [${v.id}] ${v.description}\n    Nodes: ${v.nodes.map(n => n.html).join(', ')}`)
      .join('\n')
    throw new Error(
      `axe-core found ${critical.length} critical WCAG violation(s):\n${details}`
    )
  }

  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
  }
}

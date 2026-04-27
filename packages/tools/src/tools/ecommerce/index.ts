/**
 * packages/tools/src/tools/ecommerce/index.ts
 * 3 ToolDefinition objects for web-ecommerce agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const roiCalculator: ToolDefinition = {
  slug: 'ecommerce-roi-calculator',
  name: 'Ecommerce ROI Calculator',
  agencySlug: 'ecommerce',
  benchmarkKeys: ['ecommerce-roi'],
  fields: [
    { name: 'monthlyRevenue', label: 'Monthly Revenue ($)', type: 'number', required: true, min: 0, max: 10_000_000, step: 100, placeholder: '50000' },
    { name: 'adSpend', label: 'Monthly Ad Spend ($)', type: 'number', required: true, min: 0, max: 1_000_000, step: 100, placeholder: '10000' },
    { name: 'cogs', label: 'Cost of Goods Sold (%)', type: 'number', required: true, min: 0, max: 100, step: 1, placeholder: '40' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['ecommerce-roi']!
    const revenue = Number(inputs['monthlyRevenue'])
    const adSpend = Number(inputs['adSpend'])
    const cogsPercent = Number(inputs['cogs']) / 100
    const grossProfit = revenue * (1 - cogsPercent)
    const roas = adSpend > 0 ? revenue / adSpend : 0
    const industryAvgRoas = Number(bm.data['avgRoas'] ?? 4.2)
    const roasVsBenchmark = industryAvgRoas > 0 ? ((roas - industryAvgRoas) / industryAvgRoas) * 100 : 0
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'roas', label: 'Return on Ad Spend', value: `${roas.toFixed(2)}x`, isPrimary: true, description: `Industry average: ${industryAvgRoas}x` },
        { name: 'grossProfit', label: 'Monthly Gross Profit', value: `$${grossProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'roasVsBenchmark', label: 'vs. Industry Benchmark', value: `${roasVsBenchmark > 0 ? '+' : ''}${roasVsBenchmark.toFixed(1)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const cartAbandonmentCalculator: ToolDefinition = {
  slug: 'cart-abandonment-revenue-estimator',
  name: 'Cart Abandonment Revenue Estimator',
  agencySlug: 'ecommerce',
  benchmarkKeys: ['ecommerce-cart-abandonment'],
  fields: [
    { name: 'monthlyVisitors', label: 'Monthly Store Visitors', type: 'number', required: true, min: 100, max: 10_000_000, step: 100, placeholder: '20000' },
    { name: 'addToCartRate', label: 'Add-to-Cart Rate (%)', type: 'number', required: true, min: 0, max: 100, step: 0.1, placeholder: '8' },
    { name: 'avgOrderValue', label: 'Average Order Value ($)', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '75' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['ecommerce-cart-abandonment']!
    const visitors = Number(inputs['monthlyVisitors'])
    const addToCartRate = Number(inputs['addToCartRate']) / 100
    const aov = Number(inputs['avgOrderValue'])
    const industryAbandonRate = Number(bm.data['avgAbandonRate'] ?? 0.70)
    const cartsStarted = visitors * addToCartRate
    const abandonedCarts = cartsStarted * industryAbandonRate
    const recoveryPotential = abandonedCarts * aov * 0.15
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'recoveryPotential', label: 'Monthly Recovery Potential', value: `$${recoveryPotential.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'abandonedCarts', label: 'Carts Abandoned Monthly', value: abandonedCarts.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
        { name: 'abandonRate', label: 'Industry Avg Abandon Rate', value: `${(industryAbandonRate * 100).toFixed(0)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const emailRevenuePotentialCalculator: ToolDefinition = {
  slug: 'email-revenue-potential-calculator',
  name: 'Email Revenue Potential Calculator',
  agencySlug: 'ecommerce',
  benchmarkKeys: ['ecommerce-email'],
  fields: [
    { name: 'listSize', label: 'Email List Size', type: 'number', required: true, min: 100, max: 5_000_000, step: 100, placeholder: '5000' },
    { name: 'sendFrequency', label: 'Sends per Month', type: 'number', required: true, min: 1, max: 30, step: 1, placeholder: '8' },
    { name: 'avgOrderValue', label: 'Average Order Value ($)', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '75' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['ecommerce-email']!
    const listSize = Number(inputs['listSize'])
    const sends = Number(inputs['sendFrequency'])
    const aov = Number(inputs['avgOrderValue'])
    const openRate = Number(bm.data['avgOpenRate'] ?? 0.21)
    const ctr = Number(bm.data['avgCtr'] ?? 0.025)
    const convRate = Number(bm.data['avgConvRate'] ?? 0.03)
    const monthlyRevenue = listSize * sends * openRate * ctr * convRate * aov
    const revenuePerSubscriber = listSize > 0 ? monthlyRevenue / listSize : 0
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'monthlyRevenue', label: 'Estimated Monthly Email Revenue', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'revenuePerSubscriber', label: 'Revenue per Subscriber / Month', value: `$${revenuePerSubscriber.toFixed(2)}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

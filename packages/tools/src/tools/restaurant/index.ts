/**
 * packages/tools/src/tools/restaurant/index.ts
 * 3 ToolDefinition objects for web-restaurant agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const tableTurnRevenueCalculator: ToolDefinition = {
  slug: 'table-turn-revenue-calculator',
  name: 'Table Turn Revenue Calculator',
  agencySlug: 'restaurant',
  benchmarkKeys: ['restaurant-table-turn'],
  fields: [
    { name: 'tables', label: 'Number of Tables', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '30' },
    { name: 'seatsPerTable', label: 'Seats per Table (avg)', type: 'number', required: true, min: 1, max: 20, step: 1, placeholder: '4' },
    { name: 'tableturns', label: 'Table Turns per Day', type: 'number', required: true, min: 0.5, max: 20, step: 0.5, placeholder: '2.5' },
    { name: 'avgCheckPerPerson', label: 'Average Check per Person ($)', type: 'number', required: true, min: 1, max: 10_000, step: 1, placeholder: '28' },
    { name: 'operatingDaysPerMonth', label: 'Operating Days per Month', type: 'number', required: true, min: 1, max: 31, step: 1, placeholder: '26' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['restaurant-table-turn']!
    const tables = Number(inputs['tables'])
    const seatsPerTable = Number(inputs['seatsPerTable'])
    const tableturns = Number(inputs['tableturns'])
    const avgCheckPerPerson = Number(inputs['avgCheckPerPerson'])
    const operatingDaysPerMonth = Number(inputs['operatingDaysPerMonth'])
    const dailyRevenue = tables * seatsPerTable * tableturns * avgCheckPerPerson
    const monthlyRevenue = dailyRevenue * operatingDaysPerMonth
    const annualRevenue = monthlyRevenue * 12
    const industryAvgTableturns = Number(bm.data['avgTableturnsPerDay'] ?? 2.5)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'monthlyRevenue', label: 'Monthly Dining Revenue', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'dailyRevenue', label: 'Daily Revenue', value: `$${dailyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryTableturns', label: 'Industry Avg Table Turns / Day', value: `${industryAvgTableturns}x`, description: `Annual projection: $${annualRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const foodCostMarginCalculator: ToolDefinition = {
  slug: 'food-cost-margin-calculator',
  name: 'Food Cost Margin Calculator',
  agencySlug: 'restaurant',
  benchmarkKeys: ['restaurant-food-cost'],
  fields: [
    { name: 'revenue', label: 'Monthly Revenue ($)', type: 'number', required: true, min: 0, max: 100_000_000, step: 500, placeholder: '85000' },
    { name: 'foodCost', label: 'Monthly Food Cost ($)', type: 'number', required: true, min: 0, max: 50_000_000, step: 250, placeholder: '27200' },
    { name: 'laborCost', label: 'Monthly Labor Cost ($)', type: 'number', required: true, min: 0, max: 50_000_000, step: 250, placeholder: '25500' },
    { name: 'overhead', label: 'Monthly Overhead (rent, utilities, etc.) ($)', type: 'number', required: true, min: 0, max: 10_000_000, step: 250, placeholder: '12000' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['restaurant-food-cost']!
    const revenue = Number(inputs['revenue'])
    const foodCost = Number(inputs['foodCost'])
    const laborCost = Number(inputs['laborCost'])
    const overhead = Number(inputs['overhead'])
    const totalCost = foodCost + laborCost + overhead
    const netProfit = revenue - totalCost
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0
    const foodCostPercent = revenue > 0 ? (foodCost / revenue) * 100 : 0
    const industryAvgNetMargin = Number(bm.data['avgNetMargin'] ?? 3.5)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'netMargin', label: 'Net Profit Margin', value: `${netMargin.toFixed(1)}%`, isPrimary: true, description: `Industry average: ${industryAvgNetMargin}%` },
        { name: 'netProfit', label: 'Monthly Net Profit', value: `$${netProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'foodCostPercent', label: 'Food Cost %', value: `${foodCostPercent.toFixed(1)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const cateringRevenuePotentialCalculator: ToolDefinition = {
  slug: 'catering-revenue-potential-calculator',
  name: 'Catering Revenue Potential Calculator',
  agencySlug: 'restaurant',
  benchmarkKeys: ['restaurant-catering'],
  fields: [
    { name: 'eventsPerMonth', label: 'Catering Events per Month', type: 'number', required: true, min: 0, max: 10_000, step: 1, placeholder: '8' },
    { name: 'avgEventRevenue', label: 'Average Revenue per Event ($)', type: 'number', required: true, min: 100, max: 1_000_000, step: 100, placeholder: '2800' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['restaurant-catering']!
    const eventsPerMonth = Number(inputs['eventsPerMonth'])
    const avgEventRevenue = Number(inputs['avgEventRevenue'])
    const monthlyRevenue = eventsPerMonth * avgEventRevenue
    const annualCateringRevenue = monthlyRevenue * 12
    const industryAvgEventRevenue = Number(bm.data['avgCateringEventRevenue'] ?? 2500)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'annualCateringRevenue', label: 'Annual Catering Revenue', value: `$${annualCateringRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'monthlyRevenue', label: 'Monthly Catering Revenue', value: `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'industryAvgEvent', label: 'Industry Avg Revenue per Event', value: `$${industryAvgEventRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

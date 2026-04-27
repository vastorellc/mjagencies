/**
 * packages/tools/src/tools/realestate/index.ts
 * 3 ToolDefinition objects for web-realestate agency.
 * REQ-120: real benchmarks. REQ-122: deterministic, no LLM.
 */
import type { ToolDefinition } from '../../engine/types.js'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from '../../engine/benchmark-loader.js'

export const homeValueEstimator: ToolDefinition = {
  slug: 'home-value-estimator',
  name: 'Home Value Estimator',
  agencySlug: 'realestate',
  benchmarkKeys: ['realestate-home-value'],
  fields: [
    { name: 'sqft', label: 'Square Footage', type: 'number', required: true, min: 200, max: 20_000, step: 50, placeholder: '1800' },
    { name: 'pricePerSqft', label: 'Local Price per Sq Ft ($)', type: 'number', required: true, min: 10, max: 5_000, step: 1, placeholder: '220' },
    { name: 'localAppreciation', label: 'Annual Appreciation Rate (%)', type: 'number', required: true, min: -20, max: 50, step: 0.1, placeholder: '4.5' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['realestate-home-value']!
    const sqft = Number(inputs['sqft'])
    const pricePerSqft = Number(inputs['pricePerSqft'])
    const localAppreciation = Number(inputs['localAppreciation'])
    const estimatedValue = sqft * pricePerSqft * (1 + localAppreciation / 100)
    const nationalAvgAppreciation = Number(bm.data['nationalAvgAppreciation'] ?? 4.2)
    const projectedValueNextYear = estimatedValue * (1 + nationalAvgAppreciation / 100)
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'estimatedValue', label: 'Estimated Home Value', value: `$${estimatedValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'projectedValue', label: 'Projected Value (12 Months)', value: `$${projectedValueNextYear.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'appreciationUsed', label: 'National Avg Appreciation', value: `${nationalAvgAppreciation}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const buyerAffordabilityCalculator: ToolDefinition = {
  slug: 'buyer-affordability-calculator',
  name: 'Buyer Affordability Calculator',
  agencySlug: 'realestate',
  benchmarkKeys: ['realestate-mortgage'],
  fields: [
    { name: 'annualIncome', label: 'Annual Household Income ($)', type: 'number', required: true, min: 10_000, max: 10_000_000, step: 1_000, placeholder: '95000' },
    { name: 'interestRate', label: 'Current Interest Rate (%)', type: 'number', required: true, min: 0.1, max: 20, step: 0.05, placeholder: '7.25' },
    { name: 'downPaymentPercent', label: 'Down Payment (%)', type: 'number', required: true, min: 3, max: 100, step: 1, placeholder: '20' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['realestate-mortgage']!
    const annualIncome = Number(inputs['annualIncome'])
    const interestRate = Number(inputs['interestRate'])
    const downPaymentPercent = Number(inputs['downPaymentPercent'])
    const monthlyRate = interestRate / 100 / 12
    const maxMonthlyPayment = (annualIncome * 0.28) / 12
    const loanAmount =
      monthlyRate > 0
        ? maxMonthlyPayment / ((monthlyRate * Math.pow(1 + monthlyRate, 360)) / (Math.pow(1 + monthlyRate, 360) - 1))
        : maxMonthlyPayment * 360
    const downPaymentFraction = downPaymentPercent / 100
    const maxPurchasePrice = downPaymentFraction < 1 ? loanAmount / (1 - downPaymentFraction) : loanAmount
    const downPaymentAmount = maxPurchasePrice * downPaymentFraction
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'maxPurchasePrice', label: 'Maximum Purchase Price', value: `$${maxPurchasePrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'maxMonthlyPayment', label: 'Max Monthly Payment (28% rule)', value: `$${maxMonthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'downPaymentAmount', label: 'Down Payment Required', value: `$${downPaymentAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

export const sellerNetProceedsCalculator: ToolDefinition = {
  slug: 'seller-net-proceeds-calculator',
  name: 'Seller Net Proceeds Calculator',
  agencySlug: 'realestate',
  benchmarkKeys: ['realestate-seller'],
  fields: [
    { name: 'salePrice', label: 'Expected Sale Price ($)', type: 'number', required: true, min: 10_000, max: 50_000_000, step: 1_000, placeholder: '425000' },
    { name: 'remainingMortgage', label: 'Remaining Mortgage Balance ($)', type: 'number', required: true, min: 0, max: 50_000_000, step: 1_000, placeholder: '285000' },
    { name: 'closingCosts', label: 'Estimated Closing Costs ($)', type: 'number', required: true, min: 0, max: 500_000, step: 500, placeholder: '8000' },
  ],
  calculate(inputs, benchmarks) {
    const bm = benchmarks['realestate-seller']!
    const salePrice = Number(inputs['salePrice'])
    const remainingMortgage = Number(inputs['remainingMortgage'])
    const closingCosts = Number(inputs['closingCosts'])
    const agentCommissionRate = Number(bm.data['avgCommissionRate'] ?? 0.056)
    const agentCommission = salePrice * agentCommissionRate
    const netProceeds = salePrice - agentCommission - remainingMortgage - closingCosts
    const netProceedsPercent = salePrice > 0 ? (netProceeds / salePrice) * 100 : 0
    const expired = isBenchmarkExpired(bm)
    return {
      metrics: [
        { name: 'netProceeds', label: 'Estimated Net Proceeds', value: `$${netProceeds.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, isPrimary: true },
        { name: 'agentCommission', label: 'Agent Commission', value: `$${agentCommission.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
        { name: 'netProceedsPercent', label: 'Net as % of Sale Price', value: `${netProceedsPercent.toFixed(1)}%` },
      ],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: `Industry benchmarks sourced from ${bm.sourceName}, ${bm.sourceYear}. Results are estimates, not guarantees.`,
      benchmarkExpired: expired,
      benchmarkUpdatedLabel: formatBenchmarkUpdatedLabel(bm),
    }
  },
}

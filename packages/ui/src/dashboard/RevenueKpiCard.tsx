import type * as React from 'react'
/**
 * packages/ui/src/dashboard/RevenueKpiCard.tsx
 * REQ-143 — revenue MTD + paid invoice count, from invoices (status='paid')
 * aggregate filtered to current calendar month.
 */
import { KpiCard } from './KpiCard.js'

export interface RevenueKpiCardProps {
  amountMtd: number
  invoiceCount: number
  loading?: boolean
}

export function RevenueKpiCard({ amountMtd, invoiceCount, loading }: RevenueKpiCardProps): React.ReactElement {
  if (loading) {
    return <KpiCard label="Revenue (MTD)" value="—" loading />
  }
  return (
    <KpiCard
      label="Revenue (MTD)"
      value={formatCurrency(amountMtd)}
      trend={{
        delta: invoiceCount,
        direction: 'positive',
        label: invoiceCount === 1 ? 'paid invoice' : 'paid invoices',
      }}
    />
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

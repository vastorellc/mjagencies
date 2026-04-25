import type { ReactNode } from 'react'

export default function BrandHomePage(): ReactNode {
  return (
    <main>
      <h1>MJAgency Platform</h1>
      <p>
        MJAgency is a unified multi-agency platform that powers 12 specialist agencies — ecommerce,
        growth, webdev, AI, branding, strategy, finance, engineering, product, video, and graphic —
        from a single codebase. Each agency operates at its own subdomain with dedicated content,
        tools, and CRM workflows, managed through a shared Payload CMS admin at{' '}
        <a href="/admin">/admin</a>.
      </p>
    </main>
  )
}

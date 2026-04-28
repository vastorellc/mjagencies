/**
 * packages/tools/src/pages/tool-page-template.tsx
 * Server component template for tool landing pages.
 * Renders educational content from Payload CMS + live CalculatorForm.
 *
 * Note: bodyHtml is pre-sanitized by DOMPurify in the seed script before
 * writing to Payload CMS. The dangerouslySetInnerHTML below is intentional
 * and safe — server-trusted content only.
 */
import type { ToolDefinition, BenchmarkDataset } from '../engine/types.js'
import { CalculatorForm } from './CalculatorForm.js'

interface ToolPageTemplateProps {
  tool: ToolDefinition
  benchmarks: Record<string, BenchmarkDataset>
  agencySlug: string
  /** Optional: pre-fetched page content from Payload CMS */
  pageContent?: {
    title: string
    bodyHtml?: string
    faqs?: Array<{ question: string; answer: string }>
    aioTldr?: string
    metaDescription?: string
  }
}

export function ToolPageTemplate({
  tool,
  benchmarks,
  agencySlug,
  pageContent,
}: ToolPageTemplateProps): React.JSX.Element {
  return (
    <div
      style={{ maxWidth: '960px', margin: '0 auto', padding: 'var(--mj-space-8) var(--mj-space-4)' }}
    >
      <h1
        style={{
          fontSize: 'var(--mj-text-size-4xl)',
          fontWeight: 'var(--mj-weight-bold)',
          lineHeight: 'var(--mj-leading-tight)',
          marginBottom: 'var(--mj-space-6)',
        }}
      >
        {pageContent?.title ?? tool.name}
      </h1>

      {/* AIO TL;DR — for AI-powered search indexing */}
      {pageContent?.aioTldr && (
        <p
          data-aio-tldr="true"
          style={{
            fontSize: 'var(--mj-text-size-base)',
            color: 'var(--mj-color-text-secondary)',
            marginBottom: 'var(--mj-space-8)',
            fontStyle: 'italic',
          }}
        >
          {pageContent.aioTldr}
        </p>
      )}

      {/* Calculator block — inline, REQ-413 */}
      <div style={{ marginBottom: 'var(--mj-space-12)' }}>
        <CalculatorForm tool={tool} benchmarks={benchmarks} agencySlug={agencySlug} />
      </div>

      {/* Educational body content from Payload CMS */}
      {/* bodyHtml is pre-sanitized by DOMPurify in the seed script before writing to Payload */}
      {pageContent?.bodyHtml && (
        <div
          className="tool-body-content"
          style={{ marginBottom: 'var(--mj-space-12)' }}
          dangerouslySetInnerHTML={{ __html: pageContent.bodyHtml }}
        />
      )}

      {/* FAQ section with JSON-LD structured data */}
      {pageContent?.faqs && pageContent.faqs.length > 0 && (
        <section style={{ marginBottom: 'var(--mj-space-12)' }}>
          <h2
            style={{
              fontSize: 'var(--mj-text-size-2xl)',
              fontWeight: 'var(--mj-weight-bold)',
              lineHeight: 'var(--mj-leading-tight)',
              marginBottom: 'var(--mj-space-6)',
            }}
          >
            Frequently Asked Questions
          </h2>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mj-space-6)' }}>
            {pageContent.faqs.map((faq) => (
              <div key={faq.question}>
                <dt
                  style={{
                    fontSize: 'var(--mj-text-size-lg)',
                    fontWeight: 'var(--mj-weight-bold)',
                    marginBottom: 'var(--mj-space-2)',
                  }}
                >
                  {faq.question}
                </dt>
                <dd
                  style={{
                    fontSize: 'var(--mj-text-size-base)',
                    color: 'var(--mj-color-text-secondary)',
                    lineHeight: 'var(--mj-leading-normal)',
                  }}
                >
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}

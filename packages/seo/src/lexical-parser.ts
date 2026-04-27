/**
 * packages/seo/src/lexical-parser.ts
 *
 * Recursive Lexical JSON walker for SEO plugin analysis.
 * Replaces the approximate JSON.stringify approach in content-validators.ts
 * for per-plugin scoring that requires accurate heading/link extraction.
 */
import type { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical'

export interface LexicalExtracts {
  plainText: string
  wordCount: number
  headings: Array<{ tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; text: string }>
  internalLinks: number
  paragraphs: string[]
}

function nodeText(node: SerializedLexicalNode): string {
  if ('text' in node && typeof (node as { text?: string }).text === 'string') {
    return (node as { text: string }).text
  }
  if ('children' in node && Array.isArray((node as { children?: unknown[] }).children)) {
    return (node as { children: SerializedLexicalNode[] }).children.map(nodeText).join('')
  }
  return ''
}

export function parseLexicalJson(raw: unknown): LexicalExtracts {
  const state = raw as SerializedEditorState | undefined
  if (!state?.root?.children) {
    return { plainText: '', wordCount: 0, headings: [], internalLinks: 0, paragraphs: [] }
  }

  const headings: LexicalExtracts['headings'] = []
  const paragraphs: string[] = []
  let internalLinks = 0

  function walk(nodes: SerializedLexicalNode[]): void {
    for (const node of nodes) {
      const t = node.type
      if (t === 'heading') {
        headings.push({
          tag: (node as { tag: string }).tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
          text: nodeText(node),
        })
      } else if (t === 'paragraph') {
        paragraphs.push(nodeText(node))
      } else if (t === 'link' || t === 'autolink') {
        const url = (node as { url?: string }).url ?? ''
        if (
          url.startsWith('/') ||
          (process.env['NEXT_PUBLIC_SITE_URL'] !== undefined &&
            url.includes(process.env['NEXT_PUBLIC_SITE_URL']))
        ) {
          internalLinks++
        }
      }
      if ('children' in node && Array.isArray((node as { children?: unknown[] }).children)) {
        walk((node as { children: SerializedLexicalNode[] }).children)
      }
    }
  }

  walk(state.root.children as SerializedLexicalNode[])

  const plainText = paragraphs.join(' ')
  const wordCount = plainText.split(/\s+/).filter(Boolean).length
  return { plainText, wordCount, headings, internalLinks, paragraphs }
}

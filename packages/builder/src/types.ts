/**
 * Puck visual page-builder contracts. M001 = types only; M010 (Phase 10)
 * implements the React components, server-action save handlers, and
 * agency-scoped session checks (REQ-132).
 */
export interface BuilderBlock<P = Record<string, unknown>> {
  readonly id: string
  readonly type: string
  readonly props: P
}

export interface BuilderPage {
  readonly agencyId: string
  readonly slug: string
  readonly blocks: readonly BuilderBlock[]
  readonly meta: {
    readonly title: string
    readonly description: string
    readonly seoScore?: number
  }
}

/** Server-side-only context required by every builder save action (REQ-132). */
export interface BuilderAuthContext {
  readonly agencyId: string
  readonly userId: string
  readonly role: 'super_admin' | 'admin' | 'editor'
}

/** Configuration M010 will pass into Puck's <Puck> component. Locked surface. */
export interface BuilderConfig {
  readonly agencyId: string
  readonly availableBlocks: readonly string[]
  readonly autoSaveIntervalMs: number
  readonly previewUrlPattern: string
}

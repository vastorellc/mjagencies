/**
 * packages/cms/src/editor/lexical-features.ts
 *
 * Returns all Lexical features for the Payload 3.82.1 rich text editor (REQ-053, REQ-054).
 * Called by buildPayloadConfig() in config/build-payload-config.ts.
 *
 * Feature list from specs/cms.md LEXICAL RICH TEXT EDITOR CONFIG:
 *   FixedToolbarFeature     - Top fixed toolbar always visible (REQ-054)
 *   InlineToolbarFeature    - Appears on text selection (REQ-054)
 *   BoldFeature             (was BoldTextFeature — renamed in @payloadcms/richtext-lexical 3.82.x)
 *   ItalicFeature           (was ItalicTextFeature)
 *   UnderlineFeature        (was UnderlineTextFeature)
 *   StrikethroughFeature    (was StrikethroughTextFeature)
 *   InlineCodeFeature       (was InlineCodeTextFeature)
 *   SubscriptFeature
 *   SuperscriptFeature
 *   HeadingFeature          - h1-h6
 *   ParagraphFeature
 *   AlignFeature            (was AlignmentFeature — renamed in @payloadcms/richtext-lexical 3.82.x)
 *   IndentFeature
 *   UnorderedListFeature
 *   OrderedListFeature
 *   ChecklistFeature        (was CheckListFeature — renamed in @payloadcms/richtext-lexical 3.82.x)
 *   BlockquoteFeature
 *   HorizontalRuleFeature
 *   LinkFeature
 *   UploadFeature           - Image insert with 4-tab picker
 *   EXPERIMENTAL_TableFeature (was TableFeature — renamed in @payloadcms/richtext-lexical 3.82.x)
 *
 * NOTE (Phase 7, 07-04 fix): The following features from specs/cms.md are not exported by
 * @payloadcms/richtext-lexical 3.82.1 and have been removed from this file:
 *   CodeHighlightFeature, TextColorFeature, BackgroundColorFeature,
 *   FontSizeFeature, ClearFormattingFeature, SlashMenuFeature
 * These can be re-added when the upstream package provides them (deferred to Phase 8).
 *
 * Slash menu commands from specs/cms.md:
 *   /h1 /h2 /h3 /h4 /h5 /h6
 *   /bullet /numbered /checklist
 *   /quote /code /table /image
 *   /faq-block /cta-block /callout
 *   /ai-write /ai-expand /ai-summarize
 */
import type { FeatureProviderServer } from '@payloadcms/richtext-lexical'
import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  BoldFeature,
  ItalicFeature,
  UnderlineFeature,
  StrikethroughFeature,
  InlineCodeFeature,
  SubscriptFeature,
  SuperscriptFeature,
  HeadingFeature,
  ParagraphFeature,
  AlignFeature,
  IndentFeature,
  UnorderedListFeature,
  OrderedListFeature,
  ChecklistFeature,
  BlockquoteFeature,
  HorizontalRuleFeature,
  LinkFeature,
  UploadFeature,
  EXPERIMENTAL_TableFeature,
} from '@payloadcms/richtext-lexical'

/**
 * Returns the Lexical feature set for MJAgency CMS.
 * Pass the return value into:
 *   lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures, ...getLexicalFeatures()] })
 *
 * Note: BlocksFeature({ blocks: PAYLOAD_BLOCKS }) is added separately in buildPayloadConfig()
 * so that PAYLOAD_BLOCKS can be tree-shaken when the editor config is used without blocks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLexicalFeatures(): FeatureProviderServer<any, any, any>[] {
  return [
    FixedToolbarFeature(),
    InlineToolbarFeature(),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    StrikethroughFeature(),
    InlineCodeFeature(),
    SubscriptFeature(),
    SuperscriptFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }),
    ParagraphFeature(),
    AlignFeature(),
    IndentFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    ChecklistFeature(),
    BlockquoteFeature(),
    HorizontalRuleFeature(),
    LinkFeature(),
    UploadFeature(),
    EXPERIMENTAL_TableFeature(),
  ]
}

/**
 * Slash menu command definitions for the SEO/content workflow.
 * The /ai-write, /ai-expand, /ai-summarize commands call aiHookStubs (Phase 7 wires real LiteLLM).
 *
 * NOTE: SlashMenuFeature is not exported by @payloadcms/richtext-lexical 3.82.1.
 * This constant is retained as documentation of intended commands for Phase 8 implementation.
 */
export const SLASH_COMMANDS = [
  '/h1', '/h2', '/h3', '/h4', '/h5', '/h6',
  '/bullet', '/numbered', '/checklist',
  '/quote', '/code', '/table', '/image',
  '/faq-block', '/cta-block', '/callout',
  '/ai-write', '/ai-expand', '/ai-summarize',
] as const

export type SlashCommand = (typeof SLASH_COMMANDS)[number]

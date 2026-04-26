/**
 * packages/cms/src/editor/lexical-features.ts
 *
 * Returns all Lexical features for the Payload 3.82.1 rich text editor (REQ-053, REQ-054).
 * Called by buildPayloadConfig() in config/build-payload-config.ts.
 *
 * Feature list from specs/cms.md LEXICAL RICH TEXT EDITOR CONFIG:
 *   FixedToolbarFeature     - Top fixed toolbar always visible (REQ-054)
 *   InlineToolbarFeature    - Appears on text selection (REQ-054)
 *   BoldTextFeature
 *   ItalicTextFeature
 *   UnderlineTextFeature
 *   StrikethroughTextFeature
 *   InlineCodeTextFeature
 *   SubscriptFeature
 *   SuperscriptFeature
 *   HeadingFeature          - h1-h6
 *   ParagraphFeature
 *   AlignmentFeature
 *   IndentFeature
 *   UnorderedListFeature
 *   OrderedListFeature
 *   CheckListFeature
 *   BlockquoteFeature
 *   HorizontalRuleFeature
 *   LinkFeature
 *   UploadFeature           - Image insert with 4-tab picker
 *   TableFeature
 *   CodeHighlightFeature
 *   TextColorFeature        - Brand palette tokens + custom hex
 *   BackgroundColorFeature
 *   FontSizeFeature         - Preset scale matching theme type tokens
 *   ClearFormattingFeature
 *   SlashMenuFeature        - / command menu
 *
 * Slash menu commands from specs/cms.md:
 *   /h1 /h2 /h3 /h4 /h5 /h6
 *   /bullet /numbered /checklist
 *   /quote /code /table /image
 *   /faq-block /cta-block /callout
 *   /ai-write /ai-expand /ai-summarize
 */
import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  BoldTextFeature,
  ItalicTextFeature,
  UnderlineTextFeature,
  StrikethroughTextFeature,
  InlineCodeTextFeature,
  SubscriptFeature,
  SuperscriptFeature,
  HeadingFeature,
  ParagraphFeature,
  AlignmentFeature,
  IndentFeature,
  UnorderedListFeature,
  OrderedListFeature,
  CheckListFeature,
  BlockquoteFeature,
  HorizontalRuleFeature,
  LinkFeature,
  UploadFeature,
  TableFeature,
  CodeHighlightFeature,
  TextColorFeature,
  BackgroundColorFeature,
  FontSizeFeature,
  ClearFormattingFeature,
  SlashMenuFeature,
} from '@payloadcms/richtext-lexical'

/**
 * Returns the full Lexical feature set for MJAgency CMS (27 features from specs/cms.md).
 * Pass the return value into:
 *   lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures, ...getLexicalFeatures()] })
 *
 * Note: BlocksFeature({ blocks: PAYLOAD_BLOCKS }) is added separately in buildPayloadConfig()
 * so that PAYLOAD_BLOCKS can be tree-shaken when the editor config is used without blocks.
 */
export function getLexicalFeatures(): ReturnType<typeof FixedToolbarFeature>[] {
  return [
    FixedToolbarFeature(),
    InlineToolbarFeature(),
    BoldTextFeature(),
    ItalicTextFeature(),
    UnderlineTextFeature(),
    StrikethroughTextFeature(),
    InlineCodeTextFeature(),
    SubscriptFeature(),
    SuperscriptFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }),
    ParagraphFeature(),
    AlignmentFeature(),
    IndentFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    CheckListFeature(),
    BlockquoteFeature(),
    HorizontalRuleFeature(),
    LinkFeature(),
    UploadFeature(),
    TableFeature(),
    CodeHighlightFeature(),
    TextColorFeature(),
    BackgroundColorFeature(),
    FontSizeFeature(),
    ClearFormattingFeature(),
    SlashMenuFeature(),
  ]
}

/**
 * Slash menu command definitions for the SEO/content workflow.
 * SlashMenuFeature() reads these from the registry automatically.
 * The /ai-write, /ai-expand, /ai-summarize commands call aiHookStubs (Phase 7 wires real LiteLLM).
 */
export const SLASH_COMMANDS = [
  '/h1', '/h2', '/h3', '/h4', '/h5', '/h6',
  '/bullet', '/numbered', '/checklist',
  '/quote', '/code', '/table', '/image',
  '/faq-block', '/cta-block', '/callout',
  '/ai-write', '/ai-expand', '/ai-summarize',
] as const

export type SlashCommand = (typeof SLASH_COMMANDS)[number]

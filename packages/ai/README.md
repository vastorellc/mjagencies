# @mjagency/ai

AI model gateway integration for all MJAgency apps. Routes requests through LiteLLM with per-agency cost caps. Tier 1 bulk: gemini-2.5-flash-lite + gpt-4.1-nano; Tier 2 writing: claude-sonnet-4-6; Tier 2 research: gemini-2.5-pro; Tier 3 max: claude-opus-4-6. M007 (AI Assistant + Anti-Fabrication) fills this package with model routing, PII redaction, and the anti-fabrication validator. At M001 this is a typed stub.

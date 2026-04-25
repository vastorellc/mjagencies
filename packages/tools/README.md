# @mjagency/tools

Type contracts for the 36-tool engine (REQ-120). M001 ships types only; M010 (Phase 10) implements:

- `Calculator` functions for each of the 36 tools (3 per agency × 12).
- Benchmark loader with 12-month expiry enforcement (REQ-124, REQ-406).
- Tool result rendering (inline ONLY; never separate indexed pages — REQ-413).
- PDF generation behind email gate (REQ-123) and CRM hook.

The math path is locked deterministic — `Calculator` is `(inputs) => outputs` with no LLM, no I/O (REQ-122).

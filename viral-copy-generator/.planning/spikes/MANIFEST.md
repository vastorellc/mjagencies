# Spike Manifest

Central registry of all experiments, feasibility studies, and architectural explorations.

---

## Active Spikes

### SPIKE-001: Browser Video Analysis Feasibility
**Created:** 2026-05-05  
**Status:** IN PROGRESS  
**Owner:** (To be filled)

**Objective:**
Validate that ffmpeg.wasm + TensorFlow.js + Web Audio API can handle all 20 video analysis steps in-browser on real MP4 files.

**Scope:**
- Metadata extraction
- Scene change detection
- Motion scoring
- Face detection (MediaPipe)
- Object detection (TensorFlow COCO-SSD)
- Audio analysis (energy, beats, silence)
- Luma brightness
- Integration test on real video

**Artifacts:**
- `SPIKE-001-video-analysis-browser.md` — Detailed plan
- `spike-test.html` — Interactive test harness
- `FINDINGS-001.md` — Results & fallback strategy

**Success Criteria:**
- [ ] Identify which steps work reliably
- [ ] Document performance & memory limits
- [ ] Create fallback strategy for each step
- [ ] Commit findings to git

**Timeline:** ~1-2 hours (once test is executed)

**Impact:** Directly informs Phase 3+ architecture decisions around client-side vs backend-side analysis.

---

## Completed Spikes

(None yet)

---

## Proposed Spikes

(None yet)

---

## How to Run a Spike

1. **Create spike directory** in `.planning/spikes/`
2. **Write SPIKE-###-name.md** with objective, scope, criteria
3. **Create test harness** (HTML, script, or notebook)
4. **Run experiments** and document findings
5. **Write FINDINGS-###.md** with results
6. **Commit with reference** to SPIKE number
7. **Update MANIFEST.md** with status

---

## Integration with GSD Workflow

Spikes are **independent from** the main GSD phase workflow. They:
- Don't block phases
- Feed architectural decisions
- Store findings in `.planning/spikes/`
- Reference in planning docs & code comments

Example reference in PLAN.md:
```
Per SPIKE-001 findings, motion score computation can run client-side
for videos < 30MB. Larger videos fall back to simplified metric.
See .planning/spikes/FINDINGS-001.md for details.
```


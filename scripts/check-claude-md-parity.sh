#!/usr/bin/env bash
# check-claude-md-parity.sh — Verifies that repo-root CLAUDE.md and PROJECT.md are
# byte-identical to their canonical sources in mjagency/.
#
# Invoked by:
#   - .github/workflows/pr.yml `install` job (CI gate)
#   - .github/workflows/main.yml `full-suite` job (CI gate)
#
# Exit codes:
#   0 — both files are byte-identical
#   1 — one or more files differ (CI will annotate the diff)
#
# To fix a failure:
#   cp mjagency/CLAUDE.md ./CLAUDE.md
#   cp mjagency/PROJECT.md ./PROJECT.md
#   git add CLAUDE.md PROJECT.md && git commit -m "chore: sync CLAUDE.md/PROJECT.md from mjagency/"
set -euo pipefail

fail=0
for f in CLAUDE.md PROJECT.md; do
  if ! diff -q "mjagency/$f" "$f" >/dev/null 2>&1; then
    echo "::error::$f at repo root differs from mjagency/$f. Run: cp mjagency/$f ./$f"
    diff "mjagency/$f" "$f" || true
    fail=1
  else
    echo "[parity] $f: OK (byte-identical)"
  fi
done

exit $fail

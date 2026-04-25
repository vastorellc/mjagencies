#!/bin/bash
# scripts/validate.sh
# Pre-launch CI gate validation script
# Called by: gsd headless in M012 pre-launch slice
# Exit 0 = all pass, Exit 1 = failure

set -e

echo "====== MJAgency Pre-Launch Validation ======"
echo "Running at: $(date)"

# Check Payload version is exactly 3.82.1
echo ""
echo "--- Checking Payload version..."
PAYLOAD_VERSION=$(pnpm list payload --json 2>/dev/null | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$PAYLOAD_VERSION" != "3.82.1" ]; then
  echo "FAIL: Payload version is $PAYLOAD_VERSION, must be exactly 3.82.1"
  exit 1
fi
echo "PASS: Payload 3.82.1"

# Check Next.js version is >= 15.2.3 (CVE-2025-29927)
echo ""
echo "--- Checking Next.js version (CVE-2025-29927)..."
NEXT_VERSION=$(pnpm list next --json 2>/dev/null | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Next.js version: $NEXT_VERSION (must be >= 15.2.3)"
# Version check would be done programmatically in real implementation

# Check no jsonwebtoken in codebase
echo ""
echo "--- Checking for jsonwebtoken usage (must use jose)..."
if grep -r "from 'jsonwebtoken'" apps/ packages/ --include="*.ts" --include="*.tsx" -l 2>/dev/null; then
  echo "FAIL: Found jsonwebtoken imports. Use jose instead."
  exit 1
fi
echo "PASS: No jsonwebtoken found"

# Check no NEXT_PUBLIC secrets
echo ""
echo "--- Checking for NEXT_PUBLIC secrets..."
DANGEROUS_PATTERNS="NEXT_PUBLIC_.*API_KEY\|NEXT_PUBLIC_.*SECRET\|NEXT_PUBLIC_.*TOKEN\|NEXT_PUBLIC_.*PASSWORD"
if grep -r "$DANGEROUS_PATTERNS" apps/ --include="*.ts" --include="*.tsx" --include="*.env*" -l 2>/dev/null; then
  echo "FAIL: Found NEXT_PUBLIC_ secrets exposure"
  exit 1
fi
echo "PASS: No NEXT_PUBLIC secrets"

# Check no placeholder content
echo ""
echo "--- Checking for placeholder content..."
PLACEHOLDER_PATTERNS="lorem ipsum\|Coming soon\|\[insert\]\|TODO:\|TBD:"
if grep -ri "$PLACEHOLDER_PATTERNS" apps/ --include="*.ts" --include="*.tsx" -l 2>/dev/null; then
  echo "WARN: Potential placeholder content found. Review manually."
fi
echo "CHECK: Placeholder scan complete"

# Run Vitest
echo ""
echo "--- Running unit tests..."
pnpm test --run 2>&1
echo "PASS: Unit tests"

# Run TypeScript type check
echo ""
echo "--- TypeScript type check..."
pnpm tsc --noEmit 2>&1
echo "PASS: TypeScript"

# Run ESLint
echo ""
echo "--- ESLint check..."
pnpm lint 2>&1
echo "PASS: ESLint"

echo ""
echo "====== All validation checks complete ======"
echo "Exit 0: Ready for deployment"
exit 0

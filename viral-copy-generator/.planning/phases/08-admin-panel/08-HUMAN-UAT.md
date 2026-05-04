---
status: partial
phase: 08-admin-panel
source: [08-VERIFICATION.md]
started: 2026-05-04T00:00:00Z
updated: 2026-05-04T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Admin 403 enforcement at runtime
expected: Non-admin Bearer token sent to GET /api/admin/jobs returns 403 Forbidden
result: [pending]

### 2. Admin UI button visibility
expected: Admin user sees floating "Admin" button (bottom-right); regular user sees no button anywhere
result: [pending]

### 3. All 5 tabs load real data
expected: Queue/Users/Health/Logs/Stats tabs each show live data or correct empty state (no errors)
result: [pending]

### 4. Job retry and cancel
expected: Retry transitions a failed job back to 'created'; Cancel transitions a pending job to 'cancelled'
result: [pending]

### 5. User disable/enable round-trip
expected: Disable user blocks their login; Enable restores access (verified with two browser sessions)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

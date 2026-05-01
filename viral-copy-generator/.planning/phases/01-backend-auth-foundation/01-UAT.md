---
status: complete
phase: 01-backend-auth-foundation
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
  - 01-04-SUMMARY.md
  - 01-05-SUMMARY.md
started: 2026-05-01T00:00:00Z
updated: 2026-05-01T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running backend/frontend processes. Start the backend from scratch
  (cd backend && npm run dev). The server should boot without errors, log:
    [migrate] all migrations applied
    [storage] uploads directory: ...
    [pg-boss] started
    [pg-boss] cleanup-stale-files job registered
    [server] listening on :3001
  Then curl http://localhost:3001/health and get HTTP 200 with {"ok":true,"ts":"..."}.
result: pass

### 2. Health endpoint is public
expected: |
  GET http://localhost:3001/health (no Authorization header) returns HTTP 200
  with body {"ok":true,"ts":"<ISO timestamp>"}.
result: pass

### 3. API rejects unauthenticated requests
expected: |
  GET http://localhost:3001/api/posts with no Authorization header returns
  HTTP 401 with body {"error":"Unauthorized"}.
result: pass

### 4. API rejects invalid tokens
expected: |
  GET http://localhost:3001/api/posts with header
  "Authorization: Bearer garbage_token_here" returns HTTP 401
  with body {"error":"Unauthorized"}.
result: pass

### 5. API accepts valid session token
expected: |
  Sign into Supabase in browser (or use supabase.auth.getSession() in DevTools
  console to grab the access_token). Call:
    curl -H "Authorization: Bearer <access_token>" http://localhost:3001/api/posts
  Should return HTTP 200 with body {"posts":[]}.
result: pass

### 6. Login screen renders
expected: |
  Start the frontend (cd frontend && npm run dev). Navigate to http://localhost:5173.
  You should see: dark zinc-950 background, "Viral Copy Generator" heading,
  email + password input fields, purple "Sign in" button. No sign-up link visible.
result: pass

### 7. COOP/COEP active in browser
expected: |
  With the frontend running at http://localhost:5173, open DevTools Console and type:
    self.crossOriginIsolated
  It should return true (required for SharedArrayBuffer / ffmpeg.wasm in Phase 3).
result: pass

### 8. Sign in succeeds
expected: |
  Enter the admin credentials (jamshed697@gmail.com) on the login screen and
  submit. You should arrive at the GeneratorPage showing:
    - "Viral Copy Generator" header with "Sign out" button (top right)
    - "Upload a short-form video to analyse and generate viral copy." message in the centre
  No error banner. No redirect to login.
result: pass

### 9. Wrong password shows error banner
expected: |
  On the login screen, enter a valid email but a wrong password and submit.
  A red error banner should appear above the inputs (e.g. "Invalid login credentials").
  The "Sign in" button should re-enable after the attempt.
result: pass

### 10. Sign out works
expected: |
  While on the GeneratorPage (signed in), click the "Sign out" button.
  The app should immediately return to the login screen. No errors in console.
result: pass

### 11. Session persists across page refresh
expected: |
  Sign in successfully so you are on the GeneratorPage.
  Refresh the page (F5 or Ctrl+R).
  You should stay on the GeneratorPage — not be redirected to the login screen.
  The session is restored from local storage via onAuthStateChange.
result: pass

## Summary

total: 11
passed: 11
issues: 0
skipped: 0
blocked: 0
pending: 0

## Gaps

[none yet]

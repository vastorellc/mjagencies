# Server Action Auth Pattern

**Requirements:** REQ-031, REQ-301, CLAUDE.md §3
**Rule:** `mjagency-auth/require-session-first`
**Severity:** error (blocks merge via CI lint job)

---

## The Pattern

Every server action file begins with `'use server'` and every exported async function
calls `requireSession()` as its **FIRST statement**:

```ts
'use server'
import { requireSession, ForbiddenError } from '@mjagency/auth'

export async function updatePage(data: PageData) {
  const session = await requireSession()           // ← FIRST LINE — mandatory
  if (session.agencyId !== data.agencyId) throw new ForbiddenError()
  // ... action body — session is verified before reaching here
}
```

---

## Why First Line

**Middleware is insufficient.** CVE-2025-29927 demonstrated a middleware bypass in Next.js
where attackers could skip middleware execution entirely using a crafted `x-middleware-subrequest`
header. This bypass was patched in Next.js 15.2.3 (CI enforces `>=15.2.3`), but relying solely
on middleware for auth is a single point of failure.

**Defence in depth pattern:**
- Plan 03-04's middleware (`createAuthMiddleware`) provides the **fast-path optimistic redirect**
  that returns quickly for unauthenticated requests (Edge runtime, ~0 ms).
- `requireSession()` provides the **strong post-CVE gate** that runs on the Node side inside
  the server action itself, verifying the JWT with locked `algorithms`, `issuer`, and `audience`
  claims (REQ-310, SEC-N8).

If the first statement is NOT `requireSession()`, an attacker who bypasses middleware (or any
future bypass vector) reaches application code with an unverified session.

---

## The ESLint Rule

| Property | Value |
|----------|-------|
| Rule name | `mjagency-auth/require-session-first` |
| Severity | `error` |
| Scope | `packages/*/src/**/*.{ts,tsx}`, `apps/*/src/**/*.{ts,tsx}` |
| Config file | `packages/config/eslint/index.js` |
| Rule source | `packages/auth/eslint/require-session-first.js` |
| Test suite | `packages/auth/eslint/require-session-first.test.js` (12 RuleTester cases) |

The rule fires on **any exported async function** in a file whose first top-level statement
is the `'use server'` directive Literal. It inspects the first statement of the function body
and reports `missingRequireSession` if it is not a `VariableDeclaration` with an `AwaitExpression`
calling `requireSession` (direct or namespaced).

**Exemption:** function names starting with `_` are exempt (see [Bypass for Helpers](#bypass-for-helpers)).

---

## Recipes

### Plain action (no extra MFA)

```ts
'use server'
import { requireSession, ForbiddenError } from '@mjagency/auth'

export async function deleteDraft(draftId: string, agencyId: string) {
  const session = await requireSession()
  if (session.agencyId !== agencyId) throw new ForbiddenError()
  // safe to proceed — session.agencyId is verified
}
```

### MFA-required action (explicit opt-in)

Use when a sensitive operation should require MFA regardless of the caller's role.
`super_admin` and `admin` already require MFA automatically; this opt-in covers `editor`
role or any future role.

```ts
'use server'
import { requireSession, ForbiddenError } from '@mjagency/auth'

export async function transferAgencyOwnership(data: TransferData) {
  const session = await requireSession({ requireMfa: true })  // ← force MFA for editors too
  if (session.agencyId !== data.fromAgencyId) throw new ForbiddenError()
  // proceed — MFA has been verified
}
```

### Cross-agency ownership check

`session.agencyId` is the authoritative agency claim from the verified JWT. Always compare
it against the resource's `agencyId` to prevent horizontal privilege escalation:

```ts
'use server'
import { requireSession, ForbiddenError } from '@mjagency/auth'

export async function publishPage(pageId: string) {
  const session = await requireSession()
  const page = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1)
  if (!page[0]) throw new Error('Not found')
  if (page[0].agencyId !== session.agencyId) throw new ForbiddenError()
  // proceed — caller owns this page
}
```

---

## Common Mistakes

### 1. Forgot `await`

```ts
// WRONG — synchronous call, no AwaitExpression — ESLint flags this
const session = requireSession()

// CORRECT
const session = await requireSession()
```

The rule checks that the first statement is a `VariableDeclaration` whose initialiser is an
`AwaitExpression`. A synchronous call has no `AwaitExpression` so the rule reports.

### 2. Guard before requireSession

```ts
// WRONG — the if-guard is the first statement, not requireSession
export async function updatePage(data: PageData) {
  if (!data) return                          // ← first statement: ESLint flags
  const session = await requireSession()
}

// CORRECT — validate inside or after session check
export async function updatePage(data: PageData) {
  const session = await requireSession()    // ← first statement
  if (!data) return
}
```

Move validation that does not depend on session data to AFTER `requireSession()`. If you need
to validate the structure of `data` before the DB call, do it after the session is verified.

### 3. Wrong capitalisation or import name

```ts
// WRONG — capital R is a different identifier
const session = await auth.RequireSession()   // RequireSession with capital R — not the function

// CORRECT — lowercase requireSession
const session = await requireSession()
// or namespaced:
const session = await auth.requireSession()   // lowercase — accepted by the rule
```

### 4. Wrapping redirect in try/catch

```ts
// WRONG — next/navigation's redirect() throws by design; catching it prevents the redirect
try {
  const session = await requireSession()
} catch (e) {
  // this catches the redirect throw — user never gets redirected
}

// CORRECT — let redirect bubble; only catch other errors if needed
const session = await requireSession()
```

`redirect()` in Next.js 15 throws a special `NEXT_REDIRECT` error internally. If you catch all
errors around `requireSession()`, you intercept this throw and the browser never receives the
redirect response. Do not wrap `requireSession()` in try/catch.

---

## Bypass for Helpers

Functions whose names start with `_` are exempt from the rule. This is intentional:

```ts
'use server'

// EXEMPT — internal helper not directly callable as a server action
async function _validateAndSanitize(data: unknown) {
  // no requireSession() required here — called only from other server actions
}

// NOT EXEMPT — exported as server action, must call requireSession() first
export async function updatePage(data: PageData) {
  const session = await requireSession()
  const clean = await _validateAndSanitize(data)  // safe — session already verified
}
```

The convention is: `_`-prefixed functions are private helpers that are never invoked directly
as server actions (they cannot be called from client components). They are always called from
another server action that has already verified the session.

---

## Test Coverage

The RuleTester suite in `packages/auth/eslint/require-session-first.test.js` covers 12 cases:

**Valid (rule does not report):**
1. FunctionDeclaration — first line `await requireSession()`
2. FunctionDeclaration — parameterised `await requireSession({ requireMfa: true })`
3. Arrow function — first line `await requireSession()`
4. No `'use server'` directive — rule is silent (pass-through)
5. `_`-prefixed function — exempt by naming convention
6. Namespaced call — `await auth.requireSession()`

**Invalid (rule reports `missingRequireSession`):**
1. requireSession not first — another statement precedes it
2. Guard before requireSession — if-guard is first statement
3. requireSession missing entirely
4. First await is not requireSession — wrong function called
5. Arrow function, no requireSession at all
6. Synchronous call — missing `await` (not an `AwaitExpression`)

Run the suite: `pnpm --filter=@mjagency/auth test:eslint`

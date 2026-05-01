import { describe, it } from 'vitest'

// AUTH-02: Every Express route (except /health) returns 401 without a valid token
// These tests will import the Express app once Wave 2 creates backend/src/app.ts
describe('Auth middleware (AUTH-02)', () => {
  it.todo('GET /api/posts without Authorization header returns 401')
  it.todo('GET /api/posts with invalid token returns 401')
  it.todo('GET /api/posts with valid Supabase JWT returns 200')
  it.todo('GET /health returns 200 without any token (public route)')
})

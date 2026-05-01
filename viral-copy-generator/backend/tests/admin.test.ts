import { describe, it, expect } from 'vitest'
import { adminMiddleware } from '../src/middleware/admin.js'
import type { Request, Response, NextFunction } from 'express'

// AUTH-05: Non-admin JWT → 403
// AUTH-06: Admin JWT → passes middleware
describe('Admin middleware (AUTH-05, AUTH-06)', () => {
  it('returns 403 when user has no app_metadata.role', () => {
    const req = {} as Request
    const jsonSpy: { called: boolean } = { called: false }
    const statusSpy = { code: 0 }
    const mockRes = {
      locals: { user: { app_metadata: {} } },
      status(code: number) {
        statusSpy.code = code
        return { json: () => { jsonSpy.called = true } }
      },
    } as unknown as Response

    const next = (() => {}) as NextFunction

    adminMiddleware(req, mockRes, next)
    expect(statusSpy.code).toBe(403)
  })

  it.todo('passes next() when app_metadata.role === "admin"')
})

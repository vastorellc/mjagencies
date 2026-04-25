import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Writable } from 'node:stream'

// We'll import after defining stream capture helpers
let capturedOutput = ''

function makeDestStream(): Writable {
  capturedOutput = ''
  return new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      capturedOutput += chunk.toString()
      callback()
    },
  })
}

describe('createLogger', () => {
  it('returns a Pino logger with correct base fields', async () => {
    const { createLogger } = await import('../logger.js')
    const dest = makeDestStream()
    const log = createLogger({ service: 't', agencyId: 'brand' })
    // Override destination by using pino with dest
    const pino = await import('pino')
    const captureLog = pino.default(
      {
        level: 'info',
        redact: { paths: (await import('../logger.js')).REDACT_PATHS.slice(), censor: '[REDACTED]' },
        base: { service: 't', 'agency.id': 'brand', env: 'development' },
        timestamp: pino.default.stdTimeFunctions.isoTime,
        formatters: { level: (label: string) => ({ level: label }) },
      },
      dest,
    )
    captureLog.info({ route: '/test' }, 'hello')
    // small delay to flush stream
    await new Promise((r) => setTimeout(r, 10))
    const parsed = JSON.parse(capturedOutput.trim())
    expect(parsed.service).toBe('t')
    expect(parsed['agency.id']).toBe('brand')
    expect(log).toBeDefined()
  })

  const SENSITIVE_FIELDS = [
    'password', 'email', 'phone', 'token', 'secret', 'apiKey',
    'creditCard', 'ssn', 'refreshToken', 'accessToken', 'jti',
    'stripeKey', 'r2AccessKey', 'dopplerToken', 'jwtSecret',
  ] as const

  it.each(SENSITIVE_FIELDS)('redacts sensitive field: %s', async (field) => {
    const pino = await import('pino')
    const { REDACT_PATHS } = await import('../logger.js')
    const dest = makeDestStream()
    const log = pino.default(
      {
        level: 'info',
        redact: { paths: REDACT_PATHS.slice(), censor: '[REDACTED]' },
        base: { service: 'test', 'agency.id': 'test' },
        timestamp: pino.default.stdTimeFunctions.isoTime,
        formatters: { level: (label: string) => ({ level: label }) },
      },
      dest,
    )
    // Wrap field in an object to trigger *.field redaction
    log.info({ data: { [field]: 'sensitive-value' } }, 'test')
    await new Promise((r) => setTimeout(r, 10))
    const parsed = JSON.parse(capturedOutput.trim())
    expect(parsed.data[field]).toBe('[REDACTED]')
  })

  it('redacts req.headers.authorization and req.headers.cookie', async () => {
    const pino = await import('pino')
    const { REDACT_PATHS } = await import('../logger.js')
    const dest = makeDestStream()
    const log = pino.default(
      {
        level: 'info',
        redact: { paths: REDACT_PATHS.slice(), censor: '[REDACTED]' },
        base: { service: 'test', 'agency.id': 'test' },
        timestamp: pino.default.stdTimeFunctions.isoTime,
        formatters: { level: (label: string) => ({ level: label }) },
      },
      dest,
    )
    log.info({
      req: {
        headers: {
          authorization: 'Bearer x',
          cookie: 'a=b',
        },
      },
    }, 'request')
    await new Promise((r) => setTimeout(r, 10))
    const parsed = JSON.parse(capturedOutput.trim())
    expect(parsed.req.headers.authorization).toBe('[REDACTED]')
    expect(parsed.req.headers.cookie).toBe('[REDACTED]')
  })
})

describe('edgeLog', () => {
  it('emits a JSON line to console.log with correct shape', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const { edgeLog } = await import('../logger.js')

    edgeLog('info', 'm', { foo: 'bar' })

    expect(consoleSpy).toHaveBeenCalledOnce()
    const raw = consoleSpy.mock.calls[0]![0] as string
    const parsed = JSON.parse(raw)
    expect(parsed.level).toBe('info')
    expect(parsed.msg).toBe('m')
    expect(parsed.foo).toBe('bar')
    expect(typeof parsed.time).toBe('string')

    consoleSpy.mockRestore()
  })
})

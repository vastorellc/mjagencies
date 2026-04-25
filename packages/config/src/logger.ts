import pino, { type Logger } from 'pino'

export const REDACT_PATHS = [
  // Headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-doppler-token"]',
  'res.headers["set-cookie"]',
  // Generic field names (covers nested objects)
  '*.password', '*.token', '*.secret', '*.apiKey', '*.api_key',
  '*.email', '*.phone', '*.creditCard', '*.ssn',
  '*.refreshToken', '*.accessToken', '*.jti',
  '*.stripeKey', '*.stripeSecret', '*.r2AccessKey', '*.r2SecretKey',
  '*.dopplerToken', '*.jwtSecret',
  // JWT claim payloads
  '*.payload.email', '*.payload.phone',
] as const

export function createLogger(opts: { service: string; agencyId?: string }): Logger {
  return pino({
    level: process.env.PINO_LEVEL ?? 'info',
    redact: { paths: [...REDACT_PATHS], censor: '[REDACTED]' },
    base: {
      service: opts.service,
      'agency.id': opts.agencyId ?? 'unknown',
      env: process.env.NODE_ENV ?? 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  })
}

// Edge-runtime-safe logger (Pino does NOT work in Edge — see pitfall 3.4)
export function edgeLog(level: 'info' | 'warn' | 'error', msg: string, ctx?: Record<string, unknown>): void {
  console[level === 'info' ? 'log' : level](JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...ctx,
  }))
}

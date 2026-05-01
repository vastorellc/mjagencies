import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm' as const
const SALT_LEN = 16
const IV_LEN = 12 // CLAUDE.md: 12 bytes / 96-bit NIST standard for GCM
const KEY_LEN = 32
const TAG_LEN = 16

// Layout written to DB column: base64( [salt(16)] [iv(12)] [tag(16)] [ciphertext] )
// Key derivation: scryptSync(masterKey, salt, KEY_LEN)

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY missing or too short (must be at least 32 chars)')
  }
  return Buffer.from(key, 'utf8')
}

export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = scryptSync(getMasterKey(), salt, KEY_LEN)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, tag, enc]).toString('base64')
}

export function decrypt(ciphertextB64: string): string {
  const buf = Buffer.from(ciphertextB64, 'base64')
  if (buf.length < SALT_LEN + IV_LEN + TAG_LEN) throw new Error('ciphertext too short')
  const salt = buf.subarray(0, SALT_LEN)
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const data = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN)
  const key = scryptSync(getMasterKey(), salt, KEY_LEN)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function maskKey(decrypted: string): string {
  // Per CLAUDE.md: API key responses must use `****last4` form only
  if (decrypted.length <= 4) return '****'
  return `****${decrypted.slice(-4)}`
}

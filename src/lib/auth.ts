import { createHash, randomBytes, randomUUID, createHmac, timingSafeEqual, scrypt } from 'crypto'

const HMAC_SECRET = process.env.HMAC_SECRET || 'vinocellar-pro-secret-key-2024'

// ==================== PIN HASHING ====================

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptHash(pin, salt)
  return `${salt}:${hash}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  // Plain 4-digit PINs (legacy — not hashed yet)
  if (/^\d{4}$/.test(stored)) {
    return pin === stored
  }
  // Hashed PINs (new format: salt:hash)
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const verify = await scryptHash(pin, salt)
  return timingSafeEqual(Buffer.from(hash), Buffer.from(verify))
}

/** Check if a stored PIN is plaintext (needs migration) */
export function isPinPlaintext(stored: string): boolean {
  return /^\d{4}$/.test(stored)
}

// ==================== PASSWORD HASHING ====================

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptHash(password, salt)
  return `${salt}:${hash}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const verify = await scryptHash(password, salt)
  return timingSafeEqual(Buffer.from(hash), Buffer.from(verify))
}

function scryptHash(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err: Error | null, derivedKey: Buffer) => {
      if (err) reject(err)
      resolve(derivedKey.toString('hex'))
    })
  })
}

// ==================== TOKEN MANAGEMENT ====================

export interface SessionPayload {
  userId: string
  organisationId: string
  role: string
  name: string
}

export function createToken(payload: SessionPayload): string {
  const data = JSON.stringify(payload)
  const iv = randomBytes(16).toString('hex')
  const hmac = createHmac('sha256', HMAC_SECRET).update(data).digest('hex')
  const encoded = Buffer.from(data).toString('base64url')
  return `${encoded}.${hmac}.${iv}`
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const [encoded, hmac] = parts
    const data = Buffer.from(encoded, 'base64url').toString()
    const expectedHmac = createHmac('sha256', HMAC_SECRET).update(data).digest('hex')
    if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) return null
    return JSON.parse(data) as SessionPayload
  } catch {
    return null
  }
}

// ==================== SLUG GENERATION ====================

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + randomBytes(3).toString('hex')
}

// ==================== ID GENERATION ====================

export function generateId(prefix?: string): string {
  const id = randomUUID().replace(/-/g, '').substring(0, 12)
  return prefix ? `${prefix}_${id}` : id
}

// ==================== BARCODE GENERATION ====================

export function generateBarcode(): string {
  const prefix = '600'
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('')
  return prefix + digits
}
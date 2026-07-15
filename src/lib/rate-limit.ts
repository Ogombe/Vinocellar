/**
 * Simple in-memory rate limiter for API routes.
 * Per-IP sliding window. No external dependencies needed.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given IP + action.
 * @param ip - Client IP address
 * @param action - Action identifier (e.g. 'login', 'register')
 * @param limit - Max requests in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(
  ip: string,
  action: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const key = `${ip}:${action}`
  const now = Date.now()

  let entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    store.set(key, entry)
  }

  entry.count++

  const remaining = Math.max(0, limit - entry.count)
  const success = entry.count <= limit

  return { success, remaining, resetAt: entry.resetAt }
}

/** Get client IP from request headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}
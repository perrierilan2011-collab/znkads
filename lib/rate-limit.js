/**
 * Limitation de requetes en memoire.
 *
 * Sur Vercel, chaque instance serverless possede sa propre memoire : cette
 * protection est un premier rempart, pas une garantie globale. Pour une
 * limitation distribuee en production, brancher Upstash Redis / Vercel KV.
 */

import { AppError } from './errors'
import { getClientIp } from './http'

const buckets = new Map()
let lastCleanup = Date.now()

function cleanup(now) {
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function rateLimit(key, options = {}) {
  const limit = options.limit || 60
  const windowMs = options.windowMs || 60_000
  const now = Date.now()

  cleanup(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt }
  }

  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

/**
 * Applique une limite et jette une AppError 429 si depassee.
 */
export function enforceRateLimit(request, name, limit, windowMs = 60_000) {
  const ip = getClientIp(request)
  const result = rateLimit(`${name}:${ip}`, { limit, windowMs })
  if (!result.ok) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
    throw new AppError('Trop de requetes. Reessayez plus tard.', {
      status: 429,
      code: 'RATE_LIMITED',
      details: { retryAfter }
    })
  }
  return result
}

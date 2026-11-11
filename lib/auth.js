/**
 * Sessions serveur signees (HMAC SHA-256) et authentification Discord.
 *
 * - Cookie HTTP-only, SameSite=Lax, Secure en HTTPS.
 * - Aucun token Discord n'est stocke cote client.
 * - Le cookie ne contient que l'identifiant interne et une expiration signee.
 */

import crypto from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { ConfigError, getConfig } from './config'
import { getSupabaseAdmin } from './supabase'
import { AppError } from './errors'

export const SESSION_COOKIE = 'znk_session'
export const OAUTH_STATE_COOKIE = 'znk_oauth_state'
export const REFERRAL_COOKIE = 'znk_ref'

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,16}$/

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function getSessionSecret() {
  const config = getConfig()
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    throw new ConfigError({
      missing: config.sessionSecret ? [] : ['SESSION_SECRET'],
      errors: config.sessionSecret
        ? ['SESSION_SECRET doit contenir au moins 32 caracteres.']
        : []
    })
  }
  return config.sessionSecret
}

export function createSessionToken(user, maxAgeSeconds) {
  const secret = getSessionSecret()
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.id,
      did: user.discord_id,
      iat: now,
      exp: now + maxAgeSeconds
    })
  ).toString('base64url')

  return `${payload}.${sign(payload, secret)}`
}

export function verifySessionToken(token) {
  const config = getConfig()
  if (!config.sessionSecret || !token) return null

  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null

  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  const expected = sign(payload, config.sessionSecret)

  if (!safeEqual(signature, expected)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.uid || !data?.exp) return null
    if (data.exp <= Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}

function cookieOptions(maxAge) {
  const config = getConfig()
  return {
    httpOnly: true,
    secure: config.sessionCookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge
  }
}

export function setSessionCookie(response, user) {
  const config = getConfig()
  const token = createSessionToken(user, config.sessionMaxAgeSeconds)
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(config.sessionMaxAgeSeconds))
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0))
}

export function setOAuthStateCookie(response, state) {
  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions(600))
}

export function clearOAuthStateCookie(response) {
  response.cookies.set(OAUTH_STATE_COOKIE, '', cookieOptions(0))
}

export function setReferralCookie(response, code) {
  if (!REFERRAL_CODE_PATTERN.test(code)) return false
  response.cookies.set(REFERRAL_COOKIE, code, cookieOptions(60 * 60 * 24 * 30))
  return true
}

export function clearReferralCookie(response) {
  response.cookies.set(REFERRAL_COOKIE, '', cookieOptions(0))
}

export function isValidReferralCode(code) {
  return typeof code === 'string' && REFERRAL_CODE_PATTERN.test(code)
}

export function verifyOAuthState(received, stored) {
  if (!received || !stored) return false
  return safeEqual(received, stored)
}

/**
 * Lit et verifie le cookie de session (server components et route handlers).
 */
export async function getSessionPayload() {
  const config = getConfig()
  if (!config.sessionSecret) return null

  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
}

/**
 * Utilisateur courant, relu depuis Supabase a chaque requete.
 * Mis en cache par requete React pour eviter les appels multiples.
 */
export const getCurrentUser = cache(async () => {
  const payload = await getSessionPayload()
  if (!payload) return null

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.uid)
      .maybeSingle()

    if (error) {
      console.error('[auth] lecture utilisateur impossible', { code: error.code })
      return null
    }

    return data || null
  } catch (error) {
    console.error('[auth] session non exploitable', { message: error?.message })
    return null
  }
})

/**
 * Exige un utilisateur authentifie dans une route API.
 */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError('Authentification requise.', {
      status: 401,
      code: 'UNAUTHORIZED'
    })
  }
  return user
}

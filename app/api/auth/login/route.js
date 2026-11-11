
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { buildAuthorizeUrl } from '@/lib/discord'
import { setOAuthStateCookie } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL

  if (!value) {
    throw new Error('NEXT_PUBLIC_SITE_URL manquante')
  }

  return new URL(value)
}

function loginError(code) {
  const url = new URL('/login', getSiteUrl())
  url.searchParams.set('error', code)
  return NextResponse.redirect(url)
}

export async function GET(request) {
  const limit = rateLimit(`auth-login:${getClientIp(request)}`, {
    limit: 20,
    windowMs: 60_000
  })

  if (!limit.ok) return loginError('rate_limited')

  try {
    const state = crypto.randomBytes(32).toString('base64url')
    const authorizeUrl = buildAuthorizeUrl(state)

    const response = NextResponse.redirect(authorizeUrl)

    setOAuthStateCookie(response, state)

    return response
  } catch (error) {
    console.error('[auth] impossible de demarrer OAuth', {
      code: error?.code,
      message: error?.message
    })

    return loginError(
      error?.code === 'CONFIG_ERROR' ? 'config' : 'oauth_failed'
    )
  }
}

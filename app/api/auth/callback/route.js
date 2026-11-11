
import { NextResponse } from 'next/server'
import {
  exchangeCode,
  fetchDiscordUser,
  mapDiscordUser
} from '@/lib/discord'

import {
  OAUTH_STATE_COOKIE,
  REFERRAL_COOKIE,
  clearOAuthStateCookie,
  clearReferralCookie,
  setSessionCookie,
  verifyOAuthState
} from '@/lib/auth'

import {
  applyReferral,
  upsertDiscordUser
} from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL

  if (!value) {
    throw new Error('NEXT_PUBLIC_SITE_URL manquante')
  }

  return new URL(value)
}

function diagnosticError(request, stage, code = 'UNKNOWN') {
  const url = new URL('/login', getSiteUrl())

  url.searchParams.set('error', 'oauth_failed')
  url.searchParams.set('debug', stage)
  url.searchParams.set('reason', code)

  const response = NextResponse.redirect(url)
  clearOAuthStateCookie(response)

  return response
}

export async function GET(request) {
  const params = request.nextUrl.searchParams

  if (params.get('error')) {
    return diagnosticError(
      request,
      'discord_authorization',
      'ACCESS_DENIED'
    )
  }

  const code = params.get('code')
  const state = params.get('state')

  if (!code || !state) {
    return diagnosticError(request, 'missing_code_or_state')
  }

  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (!verifyOAuthState(state, storedState)) {
    return diagnosticError(
      request,
      'state_verification',
      'STATE_MISMATCH'
    )
  }

  let stage = 'discord_token'

  try {
    const token = await exchangeCode(code)

    stage = 'discord_profile'
    const profile = await fetchDiscordUser(token.access_token)

    stage = 'supabase_user'
    const mapped = mapDiscordUser(profile)

    const { user, isNew } = await upsertDiscordUser(mapped)

    if (isNew) {
      stage = 'referral'

      const referralCode = request.cookies.get(REFERRAL_COOKIE)?.value

      if (referralCode) {
        try {
          await applyReferral({
            userId: user.id,
            referralCode
          })
        } catch (error) {
          console.error('[auth] referral error', error?.code)
        }
      }
    }

    const response = NextResponse.redirect(
      new URL('/dashboard', getSiteUrl())
    )

    setSessionCookie(response, user)
    clearOAuthStateCookie(response)
    clearReferralCookie(response)

    return response

  } catch (error) {
    console.error('[auth] diagnostic', {
      stage,
      code: error?.code,
      message: error?.message
    })

    return diagnosticError(
      request,
      stage,
      error?.code || 'UNKNOWN'
    )
  }
}

import { NextResponse } from 'next/server'
import { isValidReferralCode, setReferralCookie } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request) {
  const rawCode = (request.nextUrl.searchParams.get('ref') || '').trim().toUpperCase()
  const url = new URL('/login', request.nextUrl.origin)

  if (!isValidReferralCode(rawCode)) {
    url.searchParams.set('ref', 'invalid')
    return NextResponse.redirect(url)
  }

  const response = NextResponse.redirect(url)
  setReferralCookie(response, rawCode)
  return response
}

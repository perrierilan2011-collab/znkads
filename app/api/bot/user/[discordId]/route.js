import { requireBotAuth } from '@/lib/bot'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { getBotUserProfile } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    requireBotAuth(request)
    enforceRateLimit(request, 'bot-user', 120, 60_000)

    const { discordId } = await params
    const profile = await getBotUserProfile(discordId)

    return jsonOk({ profile })
  } catch (error) {
    return handleApiError(error)
  }
}

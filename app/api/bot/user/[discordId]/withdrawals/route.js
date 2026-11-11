import { requireBotAuth } from '@/lib/bot'
import { AppError } from '@/lib/errors'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { findUserByDiscordId, getWithdrawals } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    requireBotAuth(request)
    enforceRateLimit(request, 'bot-user-withdrawals', 120, 60_000)

    const { discordId } = await params
    const user = await findUserByDiscordId(discordId)

    if (!user) {
      throw new AppError('Utilisateur introuvable.', {
        status: 404,
        code: 'USER_NOT_FOUND'
      })
    }

    const requested = Number.parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)
    const limit = Number.isInteger(requested) ? requested : 20
    const withdrawals = await getWithdrawals(user.id, limit)

    return jsonOk({ withdrawals })
  } catch (error) {
    return handleApiError(error)
  }
}

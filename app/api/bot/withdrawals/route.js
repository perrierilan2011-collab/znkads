import { requireBotAuth } from '@/lib/bot'
import { AppError } from '@/lib/errors'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isValidWithdrawalStatus, listWithdrawalsForBot } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    requireBotAuth(request)
    enforceRateLimit(request, 'bot-withdrawals', 120, 60_000)

    const status = request.nextUrl.searchParams.get('status')
    if (status && !isValidWithdrawalStatus(status)) {
      throw new AppError('Statut de retrait invalide.', {
        status: 400,
        code: 'INVALID_WITHDRAWAL_STATUS'
      })
    }

    const requested = Number.parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)
    const limit = Number.isInteger(requested) ? requested : 50
    const withdrawals = await listWithdrawalsForBot(status || null, limit)

    return jsonOk({ withdrawals })
  } catch (error) {
    return handleApiError(error)
  }
}

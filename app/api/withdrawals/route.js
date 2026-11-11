import { requireUser } from '@/lib/auth'
import { getPublicConfig } from '@/lib/config'
import { AppError } from '@/lib/errors'
import { assertMutationRequest, handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseAmountToCents } from '@/lib/money'
import { getWithdrawals, requestWithdrawal } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    enforceRateLimit(request, 'withdrawals-list', 60, 60_000)

    const user = await requireUser()
    const config = getPublicConfig()
    const withdrawals = await getWithdrawals(user.id, 50)

    return jsonOk({
      balance_cents: user.balance_cents,
      minimum_withdrawal_cents: config.minimumWithdrawalCents,
      withdrawals_enabled: config.withdrawalsEnabled,
      discord_invite_url: config.discordWithdrawalInviteUrl,
      withdrawals
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request) {
  try {
    assertMutationRequest(request)
    enforceRateLimit(request, 'withdrawals-create', 5, 60_000)

    const user = await requireUser()

    let body
    try {
      body = await request.json()
    } catch {
      throw new AppError('Corps de requete invalide.', {
        status: 400,
        code: 'INVALID_BODY'
      })
    }

    const amountCents = parseAmountToCents(body?.amount)
    if (amountCents === null) {
      throw new AppError('Montant invalide.', {
        status: 400,
        code: 'INVALID_AMOUNT'
      })
    }

    const result = await requestWithdrawal(user, amountCents)

    return jsonOk({
      withdrawal: {
        id: result.withdrawal_id,
        amount_cents: result.amount_cents,
        status: result.status
      },
      balance_cents: result.balance_cents
    })
  } catch (error) {
    return handleApiError(error)
  }
}

import { requireBotAuth } from '@/lib/bot'
import { getConfig } from '@/lib/config'
import { AppError } from '@/lib/errors'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { findUserByDiscordId, getWalletSummary } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    requireBotAuth(request)
    enforceRateLimit(request, 'bot-balance', 120, 60_000)

    const { discordId } = await params
    const user = await findUserByDiscordId(discordId)

    if (!user) {
      throw new AppError('Utilisateur introuvable.', {
        status: 404,
        code: 'USER_NOT_FOUND'
      })
    }

    const summary = await getWalletSummary(user.id, {
      transactionLimit: 1,
      referralLimit: 1,
      withdrawalLimit: 1
    })

    return jsonOk({
      discord_id: user.discord_id,
      discord_username: user.discord_username,
      currency: getConfig().currency,
      balance_cents: user.balance_cents,
      total_earned_cents: user.total_earned_cents,
      validated_ads: summary.validatedAds,
      validated_ads_today: summary.validatedAdsToday,
      referrals_count: summary.referralsCount
    })
  } catch (error) {
    return handleApiError(error)
  }
}

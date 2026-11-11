import { requireBotAuth } from '@/lib/bot'
import { getPublicConfig } from '@/lib/config'
import { AppError } from '@/lib/errors'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { findUserByDiscordId, getReferrals, getWalletSummary } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    requireBotAuth(request)
    enforceRateLimit(request, 'bot-user-referrals', 120, 60_000)

    const { discordId } = await params
    const user = await findUserByDiscordId(discordId)

    if (!user) {
      throw new AppError('Utilisateur introuvable.', {
        status: 404,
        code: 'USER_NOT_FOUND'
      })
    }

    const config = getPublicConfig()
    const summary = await getWalletSummary(user.id, {
      transactionLimit: 1,
      referralLimit: 1,
      withdrawalLimit: 1
    })
    const referrals = await getReferrals(user.id, 50)

    return jsonOk({
      referral_code: user.referral_code,
      referral_link: `${config.siteUrl}/register?ref=${encodeURIComponent(user.referral_code)}`,
      referrals_count: summary.referralsCount,
      referrals
    })
  } catch (error) {
    return handleApiError(error)
  }
}

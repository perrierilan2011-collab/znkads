import { requireUser } from '@/lib/auth'
import { getPublicConfig } from '@/lib/config'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { getWalletSummary } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    enforceRateLimit(request, 'referrals-list', 60, 60_000)

    const user = await requireUser()
    const config = getPublicConfig()
    const summary = await getWalletSummary(user.id, {
      transactionLimit: 1,
      referralLimit: 50,
      withdrawalLimit: 1
    })

    return jsonOk({
      referral_code: user.referral_code,
      referral_link: `${config.siteUrl}/register?ref=${encodeURIComponent(user.referral_code)}`,
      referrals_count: summary.referralsCount,
      signup_reward_cents: config.referralSignupRewardCents,
      ad_reward_cents: config.referralAdRewardCents,
      required_ads: config.referralRequiredAds,
      referrals: summary.referrals
    })
  } catch (error) {
    return handleApiError(error)
  }
}

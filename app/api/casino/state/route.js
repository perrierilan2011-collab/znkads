import { requireUser } from '@/lib/auth'
import { getCasinoConfig, getCasinoState } from '@/lib/casino'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    enforceRateLimit(request, 'casino-state', 120, 60_000)

    const user = await requireUser()
    const state = await getCasinoState(user.id)

    return jsonOk({
      balance_cents: user.balance_cents,
      stats: state.stats,
      feed: state.feed,
      active: state.active,
      config: getCasinoConfig()
    })
  } catch (error) {
    return handleApiError(error)
  }
}

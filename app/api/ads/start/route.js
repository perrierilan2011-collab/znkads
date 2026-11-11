import { requireUser } from '@/lib/auth'
import { assertMutationRequest, handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { startAdSession } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    assertMutationRequest(request)
    enforceRateLimit(request, 'ads-start', 10, 60_000)

    const user = await requireUser()
    const session = await startAdSession(user)

    return jsonOk({ session })
  } catch (error) {
    return handleApiError(error)
  }
}

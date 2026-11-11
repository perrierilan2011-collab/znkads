import { requireBotAuth } from '@/lib/bot'
import { AppError } from '@/lib/errors'
import { handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { updateWithdrawalStatus } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function updateStatus(request, params) {
  requireBotAuth(request)
  enforceRateLimit(request, 'bot-withdrawal-status', 60, 60_000)

  const { id } = await params
  if (!UUID_PATTERN.test(String(id || ''))) {
    throw new AppError('Identifiant de retrait invalide.', {
      status: 400,
      code: 'INVALID_WITHDRAWAL_ID'
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    throw new AppError('Corps de requete invalide.', {
      status: 400,
      code: 'INVALID_BODY'
    })
  }

  const result = await updateWithdrawalStatus(id, String(body?.status || '').trim())

  return jsonOk({ withdrawal: result })
}

export async function PATCH(request, { params }) {
  try {
    return await updateStatus(request, params)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request, { params }) {
  try {
    return await updateStatus(request, params)
  } catch (error) {
    return handleApiError(error)
  }
}

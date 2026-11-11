import { assertMutationRequest, handleApiError, jsonOk } from '@/lib/http'
import { clearSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    assertMutationRequest(request)
    const response = jsonOk({ message: 'Deconnecte.' })
    clearSessionCookie(response)
    return response
  } catch (error) {
    return handleApiError(error)
  }
}

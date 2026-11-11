import { requireUser } from '@/lib/auth'
import { handleApiError, jsonOk } from '@/lib/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireUser()
    return jsonOk({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        discord_username: user.discord_username,
        discord_avatar: user.discord_avatar,
        balance_cents: user.balance_cents,
        total_earned_cents: user.total_earned_cents,
        referral_code: user.referral_code,
        created_at: user.created_at
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}

import { requireUser } from '@/lib/auth'
import {
  assertCasinoEnabled,
  flipCoin,
  parseBet,
  playInstant,
  rollDice,
  spinRoulette,
  spinSlots
} from '@/lib/casino'
import { AppError } from '@/lib/errors'
import { assertMutationRequest, handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INSTANT_GAMES = new Set(['slots', 'roulette', 'coinflip', 'dice'])

export async function POST(request) {
  try {
    assertMutationRequest(request)
    enforceRateLimit(request, 'casino-play', 90, 60_000)

    const user = await requireUser()
    assertCasinoEnabled()

    let body
    try {
      body = await request.json()
    } catch {
      throw new AppError('Corps de requête invalide.', {
        status: 400,
        code: 'INVALID_BODY'
      })
    }

    if (!body || typeof body !== 'object') {
      throw new AppError('Corps de requête invalide.', {
        status: 400,
        code: 'INVALID_BODY'
      })
    }

    const game = String(body.game || '')
    if (!INSTANT_GAMES.has(game)) {
      throw new AppError('Jeu invalide.', { status: 400, code: 'INVALID_GAME' })
    }

    const betCents = parseBet(body.bet)

    let outcome
    if (game === 'slots') {
      outcome = spinSlots(betCents)
    } else if (game === 'roulette') {
      outcome = spinRoulette(betCents, body.bet_type, body.bet_value)
    } else if (game === 'coinflip') {
      outcome = flipCoin(betCents, body.choice)
    } else {
      outcome = rollDice(betCents, body.direction, body.target)
    }

    const settled = await playInstant({
      userId: user.id,
      game,
      betCents,
      payoutCents: outcome.payoutCents,
      result: outcome.result
    })

    return jsonOk({
      game,
      bet_cents: betCents,
      payout_cents: outcome.payoutCents,
      balance_cents: settled.balance_cents,
      round_id: settled.round_id,
      status: settled.status,
      result: { ...outcome.result, round_id: settled.round_id }
    })
  } catch (error) {
    return handleApiError(error)
  }
}

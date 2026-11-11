import { requireUser } from '@/lib/auth'
import {
  actBlackjack,
  assertCasinoEnabled,
  blackjackResultPayload,
  finishCasinoRound,
  getCasinoRound,
  parseBet,
  publicBlackjackRound,
  raiseCasinoBet,
  startBlackjack,
  startCasinoRound,
  updateCasinoRound
} from '@/lib/casino'
import { AppError } from '@/lib/errors'
import { assertMutationRequest, handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS = new Set(['start', 'hit', 'stand', 'double'])

function toRound(base, state, status, payoutCents, result, version) {
  return publicBlackjackRound({
    id: base.id,
    bet_cents: base.bet_cents,
    version,
    state,
    status,
    payout_cents: payoutCents,
    result
  })
}

export async function POST(request) {
  try {
    assertMutationRequest(request)
    enforceRateLimit(request, 'casino-blackjack', 120, 60_000)

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

    const action = String(body?.action || '')
    if (!ACTIONS.has(action)) {
      throw new AppError('Action invalide.', {
        status: 400,
        code: 'INVALID_ACTION'
      })
    }

    if (action === 'start') {
      const betCents = parseBet(body.bet)
      const started = startBlackjack(betCents)

      const created = await startCasinoRound({
        userId: user.id,
        game: 'blackjack',
        betCents,
        state: started.state
      })

      if (!started.finished) {
        return jsonOk({
          round: toRound(
            { id: created.round_id, bet_cents: betCents },
            started.state,
            'active',
            0,
            {},
            created.version
          ),
          bet_cents: betCents,
          payout_cents: 0,
          balance_cents: created.balance_cents
        })
      }

      const result = blackjackResultPayload(started.state, started.outcome)
      const finished = await finishCasinoRound({
        roundId: created.round_id,
        userId: user.id,
        payoutCents: started.payoutCents,
        status: started.status,
        result,
        version: created.version
      })

      return jsonOk({
        round: toRound(
          { id: created.round_id, bet_cents: betCents },
          started.state,
          started.status,
          started.payoutCents,
          result,
          created.version + 1
        ),
        bet_cents: betCents,
        payout_cents: started.payoutCents,
        balance_cents: finished.balance_cents
      })
    }

    const round = await getCasinoRound(user.id, body.round_id, 'blackjack')

    if (round.status !== 'active') {
      throw new AppError('Cette partie est déjà terminée.', {
        status: 409,
        code: 'ROUND_NOT_ACTIVE'
      })
    }

    let state = round.state || {}
    let version = round.version
    let betCents = round.bet_cents
    let balanceCents = user.balance_cents

    if (action === 'double') {
      if (
        !Array.isArray(state.player) ||
        state.player.length !== 2 ||
        state.doubled
      ) {
        throw new AppError('Le double n’est pas disponible.', {
          status: 400,
          code: 'DOUBLE_NOT_ALLOWED'
        })
      }

      const extraCents = Number(state.betCents) || betCents
      const raised = await raiseCasinoBet({
        roundId: round.id,
        userId: user.id,
        extraCents
      })

      betCents = raised.bet_cents
      version = raised.version
      balanceCents = raised.balance_cents
      state = { ...state, betCents }
    }

    const acted = actBlackjack(state, action)

    if (acted.finished) {
      const result = blackjackResultPayload(acted.state, acted.outcome)
      const finished = await finishCasinoRound({
        roundId: round.id,
        userId: user.id,
        payoutCents: acted.payoutCents,
        status: acted.status,
        result,
        version
      })

      return jsonOk({
        round: toRound(
          { id: round.id, bet_cents: betCents },
          acted.state,
          acted.status,
          acted.payoutCents,
          result,
          version + 1
        ),
        bet_cents: betCents,
        payout_cents: acted.payoutCents,
        balance_cents: finished.balance_cents
      })
    }

    const updated = await updateCasinoRound({
      roundId: round.id,
      userId: user.id,
      state: acted.state,
      version
    })

    return jsonOk({
      round: toRound(
        { id: round.id, bet_cents: betCents },
        acted.state,
        'active',
        0,
        {},
        updated.version
      ),
      bet_cents: betCents,
      payout_cents: 0,
      balance_cents: balanceCents
    })
  } catch (error) {
    return handleApiError(error)
  }
}

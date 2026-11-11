import { requireUser } from '@/lib/auth'
import {
  assertCasinoEnabled,
  createMinesState,
  finishCasinoRound,
  getCasinoRound,
  minesMultiplier,
  parseBet,
  publicMinesRound,
  startCasinoRound,
  updateCasinoRound
} from '@/lib/casino'
import { AppError } from '@/lib/errors'
import { assertMutationRequest, handleApiError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS = new Set(['start', 'reveal', 'cashout'])

function toRound(base, state, status, payoutCents, result, version) {
  return publicMinesRound({
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
    enforceRateLimit(request, 'casino-mines', 180, 60_000)

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
      const mineCount = Number(body.mine_count ?? 3)

      if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) {
        throw new AppError('Le nombre de mines doit être compris entre 1 et 24.', {
          status: 400,
          code: 'INVALID_MINE_COUNT'
        })
      }

      const state = createMinesState(mineCount)
      const created = await startCasinoRound({
        userId: user.id,
        game: 'mines',
        betCents,
        state
      })

      return jsonOk({
        round: toRound(
          { id: created.round_id, bet_cents: betCents },
          state,
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

    const round = await getCasinoRound(user.id, body.round_id, 'mines')

    if (round.status !== 'active') {
      throw new AppError('Cette partie est déjà terminée.', {
        status: 409,
        code: 'ROUND_NOT_ACTIVE'
      })
    }

    const state = round.state || {}
    const revealed = Array.isArray(state.revealed) ? state.revealed : []
    const mines = Array.isArray(state.mines) ? state.mines : []
    const mineCount = Number(state.mineCount) || 3

    if (action === 'cashout') {
      if (revealed.length === 0) {
        throw new AppError('Révélez au moins une case avant d’encaisser.', {
          status: 400,
          code: 'NOTHING_TO_CASHOUT'
        })
      }

      const multiplier = minesMultiplier(mineCount, revealed.length)
      const payoutCents = Math.floor(round.bet_cents * multiplier)
      const result = { mines, revealed, multiplier, auto: false }

      const finished = await finishCasinoRound({
        roundId: round.id,
        userId: user.id,
        payoutCents,
        status: 'won',
        result,
        version: round.version
      })

      return jsonOk({
        round: toRound(
          { id: round.id, bet_cents: round.bet_cents },
          state,
          'won',
          payoutCents,
          result,
          round.version + 1
        ),
        bet_cents: round.bet_cents,
        payout_cents: payoutCents,
        balance_cents: finished.balance_cents
      })
    }

    const cell = Number(body.cell)
    if (!Number.isInteger(cell) || cell < 0 || cell > 24) {
      throw new AppError('Case invalide.', {
        status: 400,
        code: 'INVALID_CELL'
      })
    }

    if (revealed.includes(cell)) {
      throw new AppError('Cette case est déjà révélée.', {
        status: 400,
        code: 'CELL_ALREADY_REVEALED'
      })
    }

    if (mines.includes(cell)) {
      const result = { mine: cell, mines, revealed }
      const finished = await finishCasinoRound({
        roundId: round.id,
        userId: user.id,
        payoutCents: 0,
        status: 'lost',
        result,
        version: round.version
      })

      return jsonOk({
        round: toRound(
          { id: round.id, bet_cents: round.bet_cents },
          state,
          'lost',
          0,
          result,
          round.version + 1
        ),
        bet_cents: round.bet_cents,
        payout_cents: 0,
        balance_cents: finished.balance_cents
      })
    }

    const nextRevealed = [...revealed, cell]
    const nextState = { ...state, revealed: nextRevealed }
    const safeTotal = 25 - mineCount

    if (nextRevealed.length >= safeTotal) {
      const multiplier = minesMultiplier(mineCount, nextRevealed.length)
      const payoutCents = Math.floor(round.bet_cents * multiplier)
      const result = { mines, revealed: nextRevealed, multiplier, auto: true }

      const finished = await finishCasinoRound({
        roundId: round.id,
        userId: user.id,
        payoutCents,
        status: 'won',
        result,
        version: round.version
      })

      return jsonOk({
        round: toRound(
          { id: round.id, bet_cents: round.bet_cents },
          nextState,
          'won',
          payoutCents,
          result,
          round.version + 1
        ),
        bet_cents: round.bet_cents,
        payout_cents: payoutCents,
        balance_cents: finished.balance_cents
      })
    }

    const updated = await updateCasinoRound({
      roundId: round.id,
      userId: user.id,
      state: nextState,
      version: round.version
    })

    return jsonOk({
      round: toRound(
        { id: round.id, bet_cents: round.bet_cents },
        nextState,
        'active',
        0,
        {},
        updated.version
      ),
      bet_cents: round.bet_cents,
      payout_cents: 0,
      balance_cents: user.balance_cents
    })
  } catch (error) {
    return handleApiError(error)
  }
}

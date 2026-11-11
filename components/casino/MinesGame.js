'use client'

import { useState } from 'react'
import BetControls from './BetControls'
import { casinoPost, formatMultiplier } from '@/lib/casino-client'
import { centsToAmountString, formatCents } from '@/lib/money'
import { playSound } from './sound'

const MINE_OPTIONS = [1, 3, 5, 10, 20]

export default function MinesGame({
  config,
  balanceCents,
  initialRound = null,
  onBalance,
  onSettle,
  onActiveChange,
  soundOn
}) {
  const [bet, setBet] = useState(centsToAmountString(config.min_bet_cents))
  const [mineCount, setMineCount] = useState(3)
  const [round, setRound] = useState(initialRound)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function apply(data, sound = 'click') {
    setRound(data.round)
    onBalance?.(data.balance_cents)
    onActiveChange?.('mines', data.round.status === 'active' ? data.round : null)

    if (data.round.status !== 'active') {
      onSettle?.({
        game: 'mines',
        bet_cents: data.bet_cents,
        payout_cents: data.payout_cents,
        balance_cents: data.balance_cents
      })
      playSound(data.payout_cents > 0 ? 'win' : 'lose', soundOn)
    } else {
      playSound(sound, soundOn)
    }
  }

  async function send(payload, sound = 'click') {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const data = await casinoPost('/api/casino/mines', payload)
      apply(data, sound)
    } catch (actionError) {
      setError(actionError.message || 'Action impossible.')
      playSound('lose', soundOn)
    } finally {
      setLoading(false)
    }
  }

  const active = round?.status === 'active'
  const finished = round && !active
  const revealed = round?.revealed || []
  const mines = round?.mines || []
  const safeLeft = round?.safe_left ?? 0

  return (
    <div className="game-panel-body">
      <div className="game-stage mines-stage">
        <div className="mines-board">
          <div className="mines-board-head">
            <span className="mines-title">CHAMP DE MINES</span>
            <span className="mines-count">
              {active || finished ? `${round.mine_count} mines` : `${mineCount} mines`}
            </span>
          </div>

          <div className="mines-grid" aria-label="Grille de mines">
            {Array.from({ length: 25 }, (_, index) => {
              const isRevealed = revealed.includes(index)
              const isMine = mines.includes(index)
              const isHit = round?.hit_cell === index
              const showMine = finished && isMine

              return (
                <button
                  key={index}
                  type="button"
                  className={`mine-cell ${isRevealed ? 'safe' : ''} ${
                    showMine ? 'bomb' : ''
                  } ${isHit ? 'hit' : ''} ${finished && !showMine && !isRevealed ? 'dim' : ''}`}
                  onClick={() =>
                    active && !isRevealed
                      ? send({ action: 'reveal', round_id: round.id, cell: index }, 'coin')
                      : undefined
                  }
                  disabled={!active || isRevealed || loading}
                  aria-label={`Case ${index + 1}`}
                >
                  {showMine
                    ? '💣'
                    : isRevealed
                      ? '💎'
                      : active
                        ? '·'
                        : ''}
                </button>
              )
            })}
          </div>

          <div className="mines-legend">
            <span>💎 Case sûre</span>
            <span>💣 Mine</span>
          </div>
        </div>

        <div className="mines-readout">
          {active ? (
            <>
              <div className="mines-stat">
                <span>Multiplicateur</span>
                <strong>{formatMultiplier(round.multiplier)}</strong>
              </div>
              <div className="mines-stat">
                <span>Prochaine case</span>
                <strong>{formatMultiplier(round.next_multiplier)}</strong>
              </div>
              <div className="mines-stat highlight">
                <span>À encaisser</span>
                <strong>{formatCents(round.payout_cents, config.currency)}</strong>
              </div>
              <div className="mines-stat">
                <span>Cases sûres restantes</span>
                <strong>{safeLeft}</strong>
              </div>
            </>
          ) : finished ? (
            <div className={`mines-final ${round.payout_cents > 0 ? 'win' : 'lose'}`}>
              <strong>
                {round.payout_cents > 0
                  ? `+${formatCents(round.payout_cents, config.currency)}`
                  : 'Bombe touchée'}
              </strong>
              <span>
                {round.payout_cents > 0
                  ? `Encaissé à ${formatMultiplier(round.result?.multiplier || round.multiplier)}`
                  : 'La mise est perdue. Tentez une nouvelle grille.'}
              </span>
            </div>
          ) : (
            <div className="mines-final idle">
              <strong>Prêt ?</strong>
              <span>Révélez une case, puis encaissez avant la bombe.</span>
            </div>
          )}
        </div>
      </div>

      <div className="game-controls">
        {active ? (
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block casino-action"
            onClick={() => send({ action: 'cashout', round_id: round.id })}
            disabled={loading || revealed.length === 0}
          >
            {loading
              ? 'ENCAISSEMENT…'
              : revealed.length === 0
                ? 'RÉVÉLEZ UNE CASE'
                : `ENCAISSER ${formatCents(round.payout_cents, config.currency)}`}
          </button>
        ) : (
          <>
            <div className="mine-selector">
              <span className="bet-label">Nombre de mines</span>
              <div className="mine-options">
                {MINE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`bet-chip ${mineCount === option ? 'active' : ''}`}
                    onClick={() => setMineCount(option)}
                    disabled={loading}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <BetControls
              bet={bet}
              onBetChange={setBet}
              minCents={config.min_bet_cents}
              maxCents={config.max_bet_cents}
              balanceCents={balanceCents}
              currency={config.currency}
              disabled={loading}
            />

            <button
              type="button"
              className="btn btn-primary btn-lg btn-block casino-action"
              onClick={() =>
                send({ action: 'start', bet, mine_count: mineCount }, 'coin')
              }
              disabled={loading || balanceCents < config.min_bet_cents}
            >
              {loading ? 'DÉMINAGE…' : 'COMMENCER LE DÉMINAGE'}
            </button>
          </>
        )}

        {error ? <div className="alert error">{error}</div> : null}

        <div className="casino-paytable">
          <span>Plus de mines = multiplicateur plus élevé</span>
          <span>Encaissement possible à tout moment</span>
        </div>
      </div>
    </div>
  )
}

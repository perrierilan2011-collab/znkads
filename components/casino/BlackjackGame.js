'use client'

import { useState } from 'react'
import BetControls from './BetControls'
import { casinoPost, isRedCard } from '@/lib/casino-client'
import { centsToAmountString, formatCents } from '@/lib/money'
import { playSound } from './sound'

const OUTCOMES = {
  blackjack: { label: 'BLACKJACK !', className: 'win' },
  win: { label: 'GAGNÉ', className: 'win' },
  push: { label: 'ÉGALITÉ — MISE RENDUE', className: 'push' },
  bust: { label: 'BUST', className: 'lose' },
  lose: { label: 'PERDU', className: 'lose' }
}

function PlayingCard({ card, hidden = false }) {
  if (hidden) {
    return (
      <div className="playing-card card-back" aria-label="Carte cachée">
        <span>ZNK</span>
      </div>
    )
  }

  if (!card) return null

  return (
    <div className={`playing-card ${isRedCard(card) ? 'red' : 'black'}`}>
      <span className="playing-rank">{card.r}</span>
      <span className="playing-suit">{card.s}</span>
    </div>
  )
}

function Hand({ label, cards, total, hidden = false, soft = false }) {
  return (
    <div className="bj-hand">
      <div className="bj-hand-head">
        <span className="bj-hand-label">{label}</span>
        <span className="bj-hand-total">
          {total}
          {soft ? ' souple' : ''}
        </span>
      </div>
      <div className="bj-cards">
        {cards.map((card, index) => (
          <PlayingCard key={`${card.r}-${card.s}-${index}`} card={card} />
        ))}
        {hidden ? <PlayingCard hidden /> : null}
      </div>
    </div>
  )
}

export default function BlackjackGame({
  config,
  balanceCents,
  initialRound = null,
  onBalance,
  onSettle,
  onActiveChange,
  soundOn
}) {
  const [bet, setBet] = useState(centsToAmountString(config.min_bet_cents))
  const [round, setRound] = useState(initialRound)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function apply(data, sound = true) {
    setRound(data.round)
    onBalance?.(data.balance_cents)
    onActiveChange?.('blackjack', data.round.status === 'active' ? data.round : null)

    if (data.round.status !== 'active') {
      onSettle?.({
        game: 'blackjack',
        bet_cents: data.bet_cents,
        payout_cents: data.payout_cents,
        balance_cents: data.balance_cents
      })
      if (sound) {
        playSound(data.payout_cents > data.bet_cents ? 'win' : 'lose', soundOn)
      }
    } else if (sound) {
      playSound('card', soundOn)
    }
  }

  async function send(payload) {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const data = await casinoPost('/api/casino/blackjack', payload)
      apply(data)
    } catch (actionError) {
      setError(actionError.message || 'Action impossible.')
      playSound('lose', soundOn)
    } finally {
      setLoading(false)
    }
  }

  const active = round?.status === 'active'
  const finished = round && !active
  const outcome = round?.outcome ? OUTCOMES[round.outcome] : null
  const canDouble = active && round?.can_double && balanceCents >= round.bet_cents

  return (
    <div className="game-panel-body">
      <div className="game-stage bj-stage">
        <div className="bj-table">
          <div className="bj-table-felt">
            {round ? (
              <>
                <Hand
                  label="CROUPIER"
                  cards={round.dealer}
                  total={round.dealer_total}
                  hidden={round.dealer_hidden}
                />

                <div className="bj-table-center">
                  <span className="bj-chip">
                    {formatCents(round.bet_cents, config.currency)}
                  </span>
                  {finished && outcome ? (
                    <span className={`bj-outcome ${outcome.className}`}>
                      {outcome.label}
                    </span>
                  ) : (
                    <span className="bj-outcome live">EN JEU</span>
                  )}
                </div>

                <Hand
                  label="VOUS"
                  cards={round.player}
                  total={round.player_total}
                  soft={round.player_soft}
                />
              </>
            ) : (
              <div className="bj-empty">
                <span className="bj-empty-icon">♠️</span>
                <strong>Prêt à défier le croupier ?</strong>
                <p>
                  Approchez-vous de 21 sans dépasser. Blackjack payé 3:2, le
                  croupier reste à 17.
                </p>
              </div>
            )}
          </div>

          <div className="bj-table-meta">
            <span>6 jeux</span>
            <span>Blackjack 3:2</span>
            <span>Croupier 17</span>
          </div>
        </div>
      </div>

      <div className="game-controls">
        {active ? (
          <div className="bj-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => send({ action: 'hit', round_id: round.id })}
              disabled={loading}
            >
              TIRER
            </button>
            <button
              type="button"
              className="btn btn-violet"
              onClick={() => send({ action: 'stand', round_id: round.id })}
              disabled={loading}
            >
              RESTER
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => send({ action: 'double', round_id: round.id })}
              disabled={loading || !canDouble}
              title={
                canDouble
                  ? 'Doubler la mise et recevoir une seule carte'
                  : 'Double indisponible'
              }
            >
              DOUBLER
            </button>
          </div>
        ) : (
          <>
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
              onClick={() => send({ action: 'start', bet })}
              disabled={loading || balanceCents < config.min_bet_cents}
            >
              {loading ? 'DISTRIBUTION…' : finished ? 'NOUVELLE MAIN' : 'DISTRIBUER'}
            </button>
          </>
        )}

        {finished ? (
          <div className="bj-result-line">
            {round.payout_cents > 0
              ? `Gain : ${formatCents(round.payout_cents, config.currency)}`
              : 'Aucun gain sur cette main.'}
          </div>
        ) : null}

        {error ? <div className="alert error">{error}</div> : null}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import BetControls from './BetControls'
import { casinoPost } from '@/lib/casino-client'
import { centsToAmountString, formatCents } from '@/lib/money'
import { playSound } from './sound'

const CHOICES = [
  { id: 'heads', label: 'PILE', symbol: '👑' },
  { id: 'tails', label: 'FACE', symbol: '🪙' }
]

export default function CoinFlipGame({ config, balanceCents, onSettle, soundOn }) {
  const [bet, setBet] = useState(centsToAmountString(config.min_bet_cents))
  const [choice, setChoice] = useState('heads')
  const [flipping, setFlipping] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function flip() {
    if (flipping) return

    setFlipping(true)
    setError('')
    setResult(null)
    playSound('coin', soundOn)

    try {
      const data = await casinoPost('/api/casino/play', {
        game: 'coinflip',
        bet,
        choice
      })

      await new Promise((resolve) => setTimeout(resolve, 1250))

      setResult(data.result)
      playSound(data.payout_cents > 0 ? 'win' : 'lose', soundOn)

      onSettle?.({
        game: 'coinflip',
        bet_cents: data.bet_cents,
        payout_cents: data.payout_cents,
        balance_cents: data.balance_cents
      })
    } catch (flipError) {
      setError(flipError.message || 'Le lancer est impossible.')
    } finally {
      setFlipping(false)
    }
  }

  const face = result ? result.outcome : choice

  return (
    <div className="game-panel-body">
      <div className="game-stage coin-stage">
        <div className={`coin-scene ${flipping ? 'flipping' : ''}`}>
          <div className={`coin ${face === 'heads' ? 'heads' : 'tails'}`}>
            <span>{face === 'heads' ? '👑' : '🪙'}</span>
            <strong>{face === 'heads' ? 'PILE' : 'FACE'}</strong>
          </div>
          <div className="coin-shadow" aria-hidden="true" />
        </div>

        <div className="coin-readout">
          {result ? (
            result.win ? (
              <span className="readout-win">
                +{formatCents(result.payout_cents, config.currency)}
              </span>
            ) : (
              <span className="readout-lose">
                {result.outcome === 'heads' ? 'PILE' : 'FACE'} — perdu
              </span>
            )
          ) : (
            <span className="readout-muted">×1.96 — 98% de retour joueur</span>
          )}
        </div>
      </div>

      <div className="game-controls">
        <div className="coin-choices">
          {CHOICES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`coin-choice ${choice === option.id ? 'active' : ''}`}
              onClick={() => {
                setChoice(option.id)
                setResult(null)
                playSound('click', soundOn)
              }}
              disabled={flipping}
            >
              <span>{option.symbol}</span>
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>

        <BetControls
          bet={bet}
          onBetChange={setBet}
          minCents={config.min_bet_cents}
          maxCents={config.max_bet_cents}
          balanceCents={balanceCents}
          currency={config.currency}
          disabled={flipping}
        />

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block casino-action"
          onClick={flip}
          disabled={flipping || balanceCents < config.min_bet_cents}
        >
          {flipping ? 'LA PIÈCE TOURNE…' : `LANCER · ${bet || '0'} ${config.currency}`}
        </button>

        {error ? <div className="alert error">{error}</div> : null}

        <div className="casino-paytable">
          <span>Pile ou face · ×1.96</span>
          <span>Un seul lancer, résultat instantané</span>
        </div>
      </div>
    </div>
  )
}

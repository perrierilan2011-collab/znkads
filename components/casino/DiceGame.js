'use client'

import { useEffect, useRef, useState } from 'react'
import BetControls from './BetControls'
import { casinoPost } from '@/lib/casino-client'
import { centsToAmountString, formatCents, parseAmountToCents } from '@/lib/money'
import { playSound } from './sound'

export default function DiceGame({ config, balanceCents, onSettle, soundOn }) {
  const [bet, setBet] = useState(centsToAmountString(config.min_bet_cents))
  const [direction, setDirection] = useState('over')
  const [target, setTarget] = useState(50)
  const [display, setDisplay] = useState(50)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const chance = direction === 'over' ? 100 - target : target - 1
  const multiplier = chance > 0 ? Math.round((98 / chance) * 100) / 100 : 0
  const betCents = parseAmountToCents(bet) || 0
  const potential = chance > 0 ? Math.floor((betCents * 98) / chance) : 0

  async function roll() {
    if (rolling) return

    setRolling(true)
    setError('')
    setResult(null)
    playSound('spin', soundOn)

    timerRef.current = setInterval(() => {
      setDisplay(Math.floor(Math.random() * 100) + 1)
    }, 55)

    try {
      const data = await casinoPost('/api/casino/play', {
        game: 'dice',
        bet,
        direction,
        target
      })

      await new Promise((resolve) => setTimeout(resolve, 900))

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null

      setDisplay(data.result.roll)
      setResult(data.result)
      playSound(data.payout_cents > 0 ? 'win' : 'lose', soundOn)

      onSettle?.({
        game: 'dice',
        bet_cents: data.bet_cents,
        payout_cents: data.payout_cents,
        balance_cents: data.balance_cents
      })
    } catch (rollError) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      setError(rollError.message || 'Le lancer est impossible.')
    } finally {
      setRolling(false)
    }
  }

  const winning = result
    ? direction === 'over'
      ? result.roll > result.target
      : result.roll < result.target
    : null

  return (
    <div className="game-panel-body">
      <div className="game-stage dice-stage">
        <div className={`dice-number ${rolling ? 'rolling' : ''} ${
          result ? (winning ? 'win' : 'lose') : ''
        }`}>
          {display}
        </div>

        <div className="dice-track" aria-hidden="true">
          <span className="dice-marker low">1</span>
          <div className="dice-bar">
            <div
              className="dice-zone"
              style={{
                left: direction === 'under' ? '0%' : `${target}%`,
                width:
                  direction === 'under' ? `${Math.max(0, target - 1)}%` : `${100 - target}%`
              }}
            />
            <div className="dice-threshold" style={{ left: `${target}%` }} />
          </div>
          <span className="dice-marker high">100</span>
        </div>

        <div className="dice-readout">
          {result ? (
            winning ? (
              <span className="readout-win">
                +{formatCents(result.payout_cents, config.currency)} · ×{result.multiplier}
              </span>
            ) : (
              <span className="readout-lose">Raté — le dé a donné {result.roll}</span>
            )
          ) : (
            <span className="readout-muted">
              {direction === 'over' ? 'Au-dessus de' : 'En dessous de'} {target} ·
              chance {chance}% · ×{multiplier.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="game-controls">
        <div className="dice-controls">
          <div className="dice-directions">
            <button
              type="button"
              className={`dice-direction ${direction === 'under' ? 'active' : ''}`}
              onClick={() => {
                setDirection('under')
                setResult(null)
                playSound('click', soundOn)
              }}
              disabled={rolling}
            >
              EN DESSOUS
            </button>
            <button
              type="button"
              className={`dice-direction ${direction === 'over' ? 'active' : ''}`}
              onClick={() => {
                setDirection('over')
                setResult(null)
                playSound('click', soundOn)
              }}
              disabled={rolling}
            >
              AU-DESSUS
            </button>
          </div>

          <div className="dice-target">
            <div className="bet-top">
              <span className="bet-label">Cible</span>
              <strong>{target}</strong>
            </div>
            <input
              type="range"
              min="2"
              max="98"
              value={target}
              onChange={(event) => {
                setTarget(Number(event.target.value))
                setResult(null)
              }}
              disabled={rolling}
              aria-label="Cible du dé"
            />
            <div className="dice-target-scale">
              <span>Risque élevé</span>
              <span>Risque faible</span>
            </div>
          </div>
        </div>

        <div className="dice-preview">
          <div>
            <span>Chance</span>
            <strong>{chance}%</strong>
          </div>
          <div>
            <span>Multiplicateur</span>
            <strong>×{multiplier.toFixed(2)}</strong>
          </div>
          <div>
            <span>Gain potentiel</span>
            <strong>{formatCents(potential, config.currency)}</strong>
          </div>
        </div>

        <BetControls
          bet={bet}
          onBetChange={setBet}
          minCents={config.min_bet_cents}
          maxCents={config.max_bet_cents}
          balanceCents={balanceCents}
          currency={config.currency}
          disabled={rolling}
        />

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block casino-action"
          onClick={roll}
          disabled={rolling || balanceCents < config.min_bet_cents}
        >
          {rolling ? 'LE DÉ ROULE…' : `LANCER · ${bet || '0'} ${config.currency}`}
        </button>

        {error ? <div className="alert error">{error}</div> : null}
      </div>
    </div>
  )
}

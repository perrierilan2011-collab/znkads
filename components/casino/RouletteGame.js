'use client'

import { useRef, useState } from 'react'
import BetControls from './BetControls'
import { casinoPost } from '@/lib/casino-client'
import { ROULETTE_WHEEL, rouletteColor } from '@/lib/casino-constants'
import { centsToAmountString, formatCents } from '@/lib/money'
import { playSound } from './sound'

const STEP = 360 / 37

const OUTSIDE_BETS = [
  { type: 'red', label: 'ROUGE', className: 'red' },
  { type: 'black', label: 'NOIR', className: 'black' },
  { type: 'even', label: 'PAIR', className: '' },
  { type: 'odd', label: 'IMPAIR', className: '' },
  { type: 'low', label: '1 – 18', className: '' },
  { type: 'high', label: '19 – 36', className: '' }
]

const DOZENS = [
  { value: 1, label: '1re douzaine' },
  { value: 2, label: '2e douzaine' },
  { value: 3, label: '3e douzaine' }
]

const COLUMNS = [
  { value: 1, label: 'Colonne 1' },
  { value: 2, label: 'Colonne 2' },
  { value: 3, label: 'Colonne 3' }
]

function selectionLabel(betType, betValue) {
  if (betType === 'number') return `Plein ${betValue}`
  if (betType === 'dozen') return `${betValue}e douzaine`
  if (betType === 'column') return `Colonne ${betValue}`
  return OUTSIDE_BETS.find((bet) => bet.type === betType)?.label || betType
}

export default function RouletteGame({ config, balanceCents, onSettle, soundOn }) {
  const [bet, setBet] = useState(centsToAmountString(config.min_bet_cents))
  const [betType, setBetType] = useState('red')
  const [betValue, setBetValue] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const rotationRef = useRef(0)

  function choose(type, value = null) {
    if (spinning) return
    setBetType(type)
    setBetValue(value)
    setResult(null)
    playSound('click', soundOn)
  }

  async function spin() {
    if (spinning) return

    setSpinning(true)
    setError('')
    setResult(null)
    playSound('spin', soundOn)

    try {
      const data = await casinoPost('/api/casino/play', {
        game: 'roulette',
        bet,
        bet_type: betType,
        bet_value: betValue
      })

      const index = Math.max(0, ROULETTE_WHEEL.indexOf(data.result.number))
      const current = rotationRef.current
      const normalized = ((-index * STEP - current) % 360 + 360) % 360
      const next = current + 360 * 5 + normalized
      rotationRef.current = next
      setRotation(next)

      await new Promise((resolve) => setTimeout(resolve, 3950))

      setResult(data.result)
      playSound(data.payout_cents > 0 ? 'win' : 'lose', soundOn)

      onSettle?.({
        game: 'roulette',
        bet_cents: data.bet_cents,
        payout_cents: data.payout_cents,
        balance_cents: data.balance_cents
      })
    } catch (spinError) {
      setError(spinError.message || 'Le lancer est impossible.')
    } finally {
      setSpinning(false)
    }
  }

  return (
    <div className="game-panel-body">
      <div className="game-stage roulette-stage">
        <div className="roulette-layout">
          <div className="roulette-wheel-wrap">
            <div className="roulette-pointer" aria-hidden="true" />
            <div
              className="roulette-wheel"
              style={{ transform: `rotate(${rotation}deg)` }}
              aria-label="Roue de roulette européenne"
            >
              {ROULETTE_WHEEL.map((number, index) => (
                <span
                  key={number}
                  className={`wheel-number ${rouletteColor(number)}`}
                  style={{
                    transform: `rotate(${index * STEP}deg) translateY(-136px) rotate(${
                      -index * STEP
                    }deg)`
                  }}
                >
                  {number}
                </span>
              ))}
              <div className="wheel-center">
                <span>ZNK</span>
                <strong>ROULETTE</strong>
              </div>
            </div>
          </div>

          <div className="roulette-side">
            <span className="roulette-side-label">Dernier tirage</span>
            {result ? (
              <div className={`roulette-result ${result.color}`}>
                <strong>{result.number}</strong>
                <span>
                  {result.color === 'green'
                    ? 'ZÉRO'
                    : result.color === 'red'
                      ? 'ROUGE'
                      : 'NOIR'}
                </span>
              </div>
            ) : (
              <div className="roulette-result empty">
                <strong>—</strong>
                <span>EN ATTENTE</span>
              </div>
            )}

            <div className="roulette-outcome">
              {result ? (
                result.win ? (
                  <span className="readout-win">
                    +{formatCents(result.payout_cents, config.currency)}
                  </span>
                ) : (
                  <span className="readout-lose">Perdu</span>
                )
              ) : (
                <span className="readout-muted">Choisissez une mise</span>
              )}
            </div>

            <div className="roulette-selected">
              <span>Mise sélectionnée</span>
              <strong>{selectionLabel(betType, betValue)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="game-controls">
        <BetControls
          bet={bet}
          onBetChange={setBet}
          minCents={config.min_bet_cents}
          maxCents={config.max_bet_cents}
          balanceCents={balanceCents}
          currency={config.currency}
          disabled={spinning}
        />

        <div className="roulette-board">
          <button
            type="button"
            className={`roulette-cell green zero ${betType === 'number' && betValue === 0 ? 'active' : ''}`}
            onClick={() => choose('number', 0)}
            disabled={spinning}
          >
            0
          </button>

          <div className="roulette-numbers">
            {Array.from({ length: 36 }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                className={`roulette-cell ${rouletteColor(number)} ${
                  betType === 'number' && betValue === number ? 'active' : ''
                }`}
                onClick={() => choose('number', number)}
                disabled={spinning}
              >
                {number}
              </button>
            ))}
          </div>

          <div className="roulette-outside">
            {OUTSIDE_BETS.map((outside) => (
              <button
                key={outside.type}
                type="button"
                className={`roulette-outside-btn ${outside.className} ${
                  betType === outside.type ? 'active' : ''
                }`}
                onClick={() => choose(outside.type)}
                disabled={spinning}
              >
                {outside.label}
              </button>
            ))}
          </div>

          <div className="roulette-outside two">
            {DOZENS.map((dozen) => (
              <button
                key={`dozen-${dozen.value}`}
                type="button"
                className={`roulette-outside-btn ${
                  betType === 'dozen' && betValue === dozen.value ? 'active' : ''
                }`}
                onClick={() => choose('dozen', dozen.value)}
                disabled={spinning}
              >
                {dozen.label}
              </button>
            ))}
            {COLUMNS.map((column) => (
              <button
                key={`column-${column.value}`}
                type="button"
                className={`roulette-outside-btn ${
                  betType === 'column' && betValue === column.value ? 'active' : ''
                }`}
                onClick={() => choose('column', column.value)}
                disabled={spinning}
              >
                {column.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block casino-action"
          onClick={spin}
          disabled={spinning || balanceCents < config.min_bet_cents}
        >
          {spinning ? 'LA BILLE TOURNE…' : `LANCER · ${bet || '0'} ${config.currency}`}
        </button>

        {error ? <div className="alert error">{error}</div> : null}

        <div className="casino-paytable">
          <span>Plein ×36</span>
          <span>Douzaine / colonne ×3</span>
          <span>Rouge / noir / pair / impair ×2</span>
        </div>
      </div>
    </div>
  )
}

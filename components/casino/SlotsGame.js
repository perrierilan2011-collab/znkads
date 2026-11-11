'use client'

import { useEffect, useRef, useState } from 'react'
import BetControls from './BetControls'
import { casinoPost } from '@/lib/casino-client'
import { centsToAmountString, formatCents } from '@/lib/money'
import { playSound } from './sound'

const DEFAULT_GRID = ['🍒', '🍋', '🔔', '⭐', '☁️', '💎', '7️⃣', '🍒', '🍋']
const FILLER = ['🍒', '🍋', '🔔', '⭐', '☁️', '💎', '7️⃣']

function randomGrid() {
  return Array.from({ length: 9 }, () => FILLER[Math.floor(Math.random() * FILLER.length)])
}

export default function SlotsGame({ config, balanceCents, onSettle, soundOn }) {
  const [bet, setBet] = useState(centsToAmountString(config.min_bet_cents))
  const [grid, setGrid] = useState(DEFAULT_GRID)
  const [result, setResult] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function spin() {
    if (spinning) return

    setSpinning(true)
    setError('')
    setResult(null)
    playSound('spin', soundOn)

    timerRef.current = setInterval(() => setGrid(randomGrid()), 80)

    try {
      const data = await casinoPost('/api/casino/play', { game: 'slots', bet })
      await new Promise((resolve) => setTimeout(resolve, 850))

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null

      setGrid(data.result.emojis)
      setResult(data.result)
      playSound(data.payout_cents > 0 ? 'win' : 'lose', soundOn)

      onSettle?.({
        game: 'slots',
        bet_cents: data.bet_cents,
        payout_cents: data.payout_cents,
        balance_cents: data.balance_cents
      })
    } catch (spinError) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      setError(spinError.message || 'Le tour est impossible.')
    } finally {
      setSpinning(false)
    }
  }

  const winningCells = new Set()
  const winningLines = (result?.lines || []).filter((line) => line.win)
  for (const line of winningLines) {
    for (const cell of line.cells) winningCells.add(cell)
  }

  return (
    <div className="game-panel-body">
      <div className="game-stage slots-stage">
        <div className={`slots-machine ${spinning ? 'is-spinning' : ''}`}>
          <div className="slots-topline">
            <span>PUFF &amp; PUFF</span>
            <span className="slots-lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>5 LIGNES</span>
          </div>

          <div className="slots-grid" aria-label="Grille de la machine à sous">
            {grid.map((emoji, index) => (
              <div
                key={index}
                className={`slot-cell ${spinning ? 'spinning' : ''} ${
                  !spinning && winningCells.has(index) ? 'win' : ''
                }`}
              >
                {emoji}
              </div>
            ))}
          </div>

          <div className="slots-paylines">
            {winningLines.length ? (
              winningLines.map((line) => (
                <span className="payline-chip" key={line.index}>
                  Ligne {line.index + 1} · {line.emoji} ×{line.multiplier}
                </span>
              ))
            ) : (
              <span className="payline-chip muted">
                5 lignes actives · alignez 3 symboles
              </span>
            )}
          </div>
        </div>

        <div className="game-readout">
          {result ? (
            result.payout_cents > 0 ? (
              <span className="readout-win">
                +{formatCents(result.payout_cents, config.currency)}
              </span>
            ) : (
              <span className="readout-lose">Aucune ligne gagnante</span>
            )
          ) : (
            <span className="readout-muted">
              Les nuages cachent le jackpot. Tournez.
            </span>
          )}
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

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block casino-action"
          onClick={spin}
          disabled={spinning || balanceCents < config.min_bet_cents}
        >
          {spinning ? 'ÇA TOURNE…' : `TOURNER · ${bet || '0'} ${config.currency}`}
        </button>

        {error ? <div className="alert error">{error}</div> : null}

        <div className="casino-paytable">
          <span>🍒 ×2</span>
          <span>🍋 ×3</span>
          <span>🔔 ×5</span>
          <span>⭐ ×9</span>
          <span>☁️ ×20</span>
          <span>💎 ×40</span>
          <span>7️⃣ ×100</span>
        </div>
      </div>
    </div>
  )
}

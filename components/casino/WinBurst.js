'use client'

import { useEffect } from 'react'
import { formatCents } from '@/lib/money'

const COLORS = ['#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#c4b5fd', '#fb7185']

export default function WinBurst({ win, currency, onDone }) {
  useEffect(() => {
    if (!win) return undefined
    const timer = setTimeout(() => onDone?.(), 3200)
    return () => clearTimeout(timer)
  }, [win, onDone])

  if (!win) return null

  const pieces = Array.from({ length: 30 }, (_, index) => ({
    left: (index * 37 + 13) % 100,
    delay: (index % 10) * 0.055,
    duration: 1.4 + (index % 5) * 0.18,
    color: COLORS[index % COLORS.length],
    rotate: (index * 53) % 360
  }))

  return (
    <div
      className="win-burst"
      role="status"
      aria-live="polite"
      onClick={onDone}
    >
      <div className="win-confetti" aria-hidden="true">
        {pieces.map((piece, index) => (
          <span
            key={index}
            style={{
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              transform: `rotate(${piece.rotate}deg)`
            }}
          />
        ))}
      </div>

      <div className="win-card">
        <span className="win-eyebrow">{win.label || 'GAIN'}</span>
        <strong>{formatCents(win.amount_cents, currency)}</strong>
        {win.multiplier ? <span className="win-mult">{win.multiplier}</span> : null}
        <span className="win-sub">Cliquez pour continuer</span>
      </div>
    </div>
  )
}

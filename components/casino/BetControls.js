'use client'

import { centsToAmountString, formatCents, parseAmountToCents } from '@/lib/money'

export default function BetControls({
  bet,
  onBetChange,
  minCents,
  maxCents,
  balanceCents,
  currency,
  disabled = false,
  label = 'Mise'
}) {
  const ceilingCents = Math.max(
    0,
    Math.min(Number(maxCents) || 0, Number(balanceCents) || 0)
  )
  const canPlay = ceilingCents >= minCents && !disabled

  const chips = [
    minCents,
    Math.min(minCents * 2, ceilingCents),
    Math.min(100, ceilingCents),
    Math.min(500, ceilingCents),
    ceilingCents
  ]
    .filter((cents, index, list) => cents >= minCents && list.indexOf(cents) === index)
    .slice(0, 5)

  const currentCents = parseAmountToCents(bet) ?? minCents

  function setCents(cents) {
    const safeCents = Number.isFinite(cents) ? cents : minCents
    onBetChange(
      centsToAmountString(Math.max(minCents, Math.min(ceilingCents, safeCents)))
    )
  }

  function handleInput(event) {
    const value = event.target.value.replace(/[^0-9.,]/g, '')
    onBetChange(value)
  }

  function handleBlur() {
    const parsed = Number(String(bet).replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCents(minCents)
      return
    }
    setCents(Math.round(parsed * 100))
  }

  return (
    <div className="bet-controls">
      <div className="bet-top">
        <span className="bet-label">{label}</span>
        <span className="bet-max">Max {formatCents(ceilingCents, currency)}</span>
      </div>

      <div className="bet-row">
        <div className="bet-input-wrap">
          <input
            className="input bet-input"
            inputMode="decimal"
            autoComplete="off"
            aria-label={label}
            value={bet}
            onChange={handleInput}
            onBlur={handleBlur}
            disabled={disabled}
          />
          <span className="bet-currency">{currency}</span>
        </div>

        <div className="bet-steppers">
          <button
            type="button"
            className="bet-step"
            onClick={() => setCents(Math.floor(currentCents / 2))}
            disabled={!canPlay}
            aria-label="Diviser la mise par deux"
          >
            ½
          </button>
          <button
            type="button"
            className="bet-step"
            onClick={() => setCents(currentCents * 2)}
            disabled={!canPlay}
            aria-label="Doubler la mise"
          >
            2×
          </button>
          <button
            type="button"
            className="bet-step bet-step-max"
            onClick={() => setCents(ceilingCents)}
            disabled={!canPlay}
          >
            MAX
          </button>
        </div>
      </div>

      <div className="bet-chips">
        {chips.map((cents) => (
          <button
            key={cents}
            type="button"
            className={`bet-chip ${currentCents === cents ? 'active' : ''}`}
            onClick={() => setCents(cents)}
            disabled={!canPlay}
          >
            {formatCents(cents, currency)}
          </button>
        ))}
      </div>

      {ceilingCents < minCents ? (
        <p className="bet-warning">
          Solde insuffisant pour la mise minimale de {formatCents(minCents, currency)}.
          Gagnez d’abord quelques publicités.
        </p>
      ) : null}
    </div>
  )
}

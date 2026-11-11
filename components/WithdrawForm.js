'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCents } from '@/lib/money'

export default function WithdrawForm({
  balanceCents,
  minimumCents,
  currency,
  enabled
}) {
  const router = useRouter()
  const [amount, setAmount] = useState((minimumCents / 100).toFixed(2))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const maxAmount = (balanceCents / 100).toFixed(2)
  const belowMinimum = balanceCents < minimumCents

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-znk-csrf': '1'
        },
        body: JSON.stringify({ amount })
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.message || 'Demande de retrait impossible.')
      }

      setSuccess(
        `Demande enregistrée. Nouveau solde : ${formatCents(
          data.balance_cents,
          currency
        )}. Ouvrez le Discord pour finaliser le traitement.`
      )
      setAmount((minimumCents / 100).toFixed(2))
      router.refresh()
    } catch (submitError) {
      setError(submitError.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  if (!enabled) {
    return (
      <div className="alert info">
        Les retraits sont temporairement désactivés.
      </div>
    )
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="withdraw-amount">Montant à retirer ({currency})</label>
        <div className="input-row">
          <input
            id="withdraw-amount"
            className="input"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={(minimumCents / 100).toFixed(2)}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setAmount(maxAmount)}
          >
            MAX
          </button>
        </div>
        <p className="field-hint">
          Minimum : {formatCents(minimumCents, currency)} · Disponible :{' '}
          {formatCents(balanceCents, currency)}
        </p>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={loading || belowMinimum}
      >
        {loading ? 'ENVOI...' : 'DEMANDER LE RETRAIT'}
      </button>

      {belowMinimum ? (
        <div className="alert info">
          Votre solde est inférieur au minimum de retrait.
        </div>
      ) : null}

      {error ? <div className="alert error">{error}</div> : null}
      {success ? <div className="alert success">{success}</div> : null}
    </form>
  )
}

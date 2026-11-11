'use client'

import { useState } from 'react'

export default function StartAdButton({ disabled = false, label = 'REGARDER UNE PUBLICITÉ' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/ads/start', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-znk-csrf': '1'
        },
        body: '{}'
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.message || 'Impossible de démarrer la publicité.')
      }

      if (!data?.session?.redirectUrl) {
        throw new Error('La régie publicitaire n’a pas fourni de destination valide.')
      }

      window.location.assign(data.session.redirectUrl)
    } catch (startError) {
      setError(startError.message || 'Une erreur est survenue.')
      setLoading(false)
    }
  }

  return (
    <div className="action-stack">
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={handleStart}
        disabled={disabled || loading}
      >
        {loading ? 'OUVERTURE...' : label}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}

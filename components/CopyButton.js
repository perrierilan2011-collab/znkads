'use client'

import { useState } from 'react'

export default function CopyButton({ value, label = 'COPIER MON LIEN', compact = false }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function handleCopy() {
    setError('')
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copie impossible. Sélectionnez le lien manuellement.')
    }
  }

  return (
    <div className={`copy-wrap ${compact ? 'copy-wrap-compact' : ''}`}>
      <button
        type="button"
        className={`btn btn-ghost ${compact ? 'btn-sm' : ''}`}
        onClick={handleCopy}
      >
        {copied ? 'COPIÉ' : label}
      </button>
      {error ? <span className="copy-error">{error}</span> : null}
    </div>
  )
}

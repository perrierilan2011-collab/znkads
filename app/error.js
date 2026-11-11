'use client'

import Link from 'next/link'

export default function ErrorPage({ reset }) {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <span className="eyebrow">ERREUR</span>
        <h1>Une erreur est survenue</h1>
        <p className="muted">
          La page n’a pas pu être chargée. Vous pouvez réessayer ou revenir au
          portefeuille.
        </p>
        <div className="form-stack" style={{ marginTop: '22px' }}>
          <button type="button" className="btn btn-primary btn-block" onClick={reset}>
            RÉESSAYER
          </button>
          <Link className="btn btn-ghost btn-block" href="/dashboard">
            RETOUR AU PORTEFEUILLE
          </Link>
        </div>
      </div>
    </div>
  )
}

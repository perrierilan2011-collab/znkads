import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <span className="eyebrow">404</span>
        <h1>Page introuvable</h1>
        <p className="muted">
          Cette adresse n’existe pas ou a été déplacée.
        </p>
        <Link
          className="btn btn-primary btn-block"
          href="/"
          style={{ marginTop: '22px' }}
        >
          RETOUR À L’ACCUEIL
        </Link>
      </div>
    </div>
  )
}

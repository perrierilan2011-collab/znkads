import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export const metadata = {
  title: 'Connexion'
}

const ERROR_MESSAGES = {
  config:
    'La configuration du site est incomplète. Renseignez les variables d’environnement puis redéployez.',
  state_mismatch:
    'La session de connexion a expiré ou a été invalidée. Réessayez.',
  access_denied: 'Vous avez annulé la connexion Discord.',
  oauth_failed: 'La connexion Discord a échoué. Réessayez dans un instant.',
  database:
    'La base de données n’est pas initialisée. Exécutez supabase/schema.sql dans Supabase.',
  rate_limited: 'Trop de tentatives de connexion. Réessayez dans une minute.'
}

export default async function LoginPage({ searchParams }) {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  const params = await searchParams
  const error = params?.error
  const invalidReferral = params?.ref === 'invalid'

  return (
    <div className="auth-wrap">
      <div className="card auth-card fade-in">
        <span className="eyebrow">ACCÈS SÉCURISÉ</span>
        <h1>Connexion</h1>
        <p className="muted auth-lead">
          Utilisez votre compte Discord pour accéder à votre portefeuille. Aucune
          autre information ne vous sera demandée.
        </p>

        {error ? (
          <div className="alert error">
            {ERROR_MESSAGES[error] || 'La connexion a échoué. Réessayez.'}
          </div>
        ) : null}

        {invalidReferral ? (
          <div className="alert info">
            Le lien de parrainage utilisé est invalide. Vous pouvez continuer sans
            parrain.
          </div>
        ) : null}

        <a className="btn btn-primary btn-lg btn-block" href="/api/auth/login">
          CONNECTER DISCORD
        </a>

        <p className="fine-print">
          En continuant, vous acceptez que votre identifiant, votre pseudo et votre
          avatar Discord soient utilisés pour créer votre compte ZNK ADS.
        </p>
      </div>
    </div>
  )
}

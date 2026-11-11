import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPublicConfig } from '@/lib/config'
import { formatCents } from '@/lib/money'

export default async function HomePage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  const config = getPublicConfig()

  return (
    <>
      <section className="hero container">
        <span className="hero-badge">PUBLICITÉS RÉMUNÉRÉES</span>
        <h1 className="hero-title">
          <span className="gradient-text">ZNK ADS</span>
        </h1>
        <p className="hero-lead">
          Transformez votre temps en récompenses. Connectez votre compte Discord,
          regardez des publicités validées par nos partenaires et retirez vos gains.
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href="/api/auth/login">
            CONNECTER DISCORD
          </a>
          <a className="btn btn-ghost btn-lg" href="#fonctionnement">
            VOIR LE FONCTIONNEMENT
          </a>
        </div>

        <div className="stats-strip">
          <div className="stat-cell">
            <strong>{formatCents(config.adRewardCents, config.currency)}</strong>
            <span>par publicité validée</span>
          </div>
          <div className="stat-cell">
            <strong>{config.dailyAdLimit}</strong>
            <span>publicités par jour</span>
          </div>
          <div className="stat-cell">
            <strong>
              {formatCents(config.minimumWithdrawalCents, config.currency)}
            </strong>
            <span>retrait minimum</span>
          </div>
        </div>

        {!config.adRewardsEnabled ? (
          <div className="alert info hero-note">
            Les récompenses publicitaires sont momentanément désactivées. Elles
            seront activées lorsque la régie partenaire autorisera ce modèle de
            rémunération.
          </div>
        ) : null}
      </section>

      <section className="section container" id="fonctionnement">
        <div className="section-head">
          <span className="eyebrow">FONCTIONNEMENT</span>
          <h2>Trois étapes, aucune complication.</h2>
        </div>

        <div className="steps">
          <article className="card step">
            <span className="step-number">01</span>
            <h3>Connectez Discord</h3>
            <p>
              Une authentification sécurisée avec la seule permission
              <code> identify</code>. Votre compte est créé automatiquement et lié
              définitivement à votre identifiant Discord.
            </p>
          </article>

          <article className="card step">
            <span className="step-number">02</span>
            <h3>Regardez des publicités</h3>
            <p>
              Chaque publicité est vérifiée par notre régie partenaire. Le crédit
              intervient uniquement après une confirmation authentifiée. Un simple
              compte à rebours ne suffit jamais.
            </p>
          </article>

          <article className="card step">
            <span className="step-number">03</span>
            <h3>Retirez via Discord</h3>
            <p>
              À partir de{' '}
              {formatCents(config.minimumWithdrawalCents, config.currency)},
              demandez votre retrait puis ouvrez un ticket sur notre Discord. Chaque
              demande est suivie jusqu’au paiement.
            </p>
          </article>
        </div>
      </section>

      <section className="section container">
        <div className="split-grid">
          <article className="card card-pad">
            <span className="eyebrow">PORTEFEUILLE</span>
            <h2 className="card-title">Un solde réel, pas une démo.</h2>
            <p className="muted">
              Les montants sont stockés en centimes dans Supabase et mis à jour par
              des transactions atomiques. Chaque crédit, remboursement et retrait
              est journalisé et consultable dans votre historique.
            </p>
            <ul className="check-list">
              <li>Solde disponible et total gagné en temps réel.</li>
              <li>Historique complet des transactions.</li>
              <li>Demandes de retrait avec statut de traitement.</li>
            </ul>
          </article>

          <article className="card card-pad">
            <span className="eyebrow">PARRAINAGE</span>
            <h2 className="card-title">Invitez et progressez ensemble.</h2>
            <p className="muted">
              Recevez{' '}
              {formatCents(config.referralSignupRewardCents, config.currency)} par
              inscription et{' '}
              {formatCents(config.referralAdRewardCents, config.currency)}{' '}
              supplémentaires lorsque votre filleul atteint{' '}
              {config.referralRequiredAds} publicités validées.
            </p>
            <ul className="check-list">
              <li>Un code et un lien uniques par compte.</li>
              <li>Un seul parrain par utilisateur.</li>
              <li>Récompenses versées une seule fois, après vérification.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section container">
        <div className="card card-pad cta-card">
          <div>
            <span className="eyebrow">PRÊT À COMMENCER</span>
            <h2 className="card-title">Votre portefeuille vous attend.</h2>
            <p className="muted">
              Connexion Discord sécurisée. Aucun mot de passe à créer.
            </p>
          </div>
          <a className="btn btn-primary btn-lg" href="/api/auth/login">
            CONNECTER DISCORD
          </a>
        </div>
      </section>
    </>
  )
}

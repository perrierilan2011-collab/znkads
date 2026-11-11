import Link from 'next/link'
import { redirect } from 'next/navigation'
import StartAdButton from '@/components/StartAdButton'
import { getCurrentUser } from '@/lib/auth'
import { getPublicConfig } from '@/lib/config'
import { formatCents } from '@/lib/money'
import { getAdSessions, getWalletSummary } from '@/lib/wallet'

export const metadata = {
  title: 'Publicités'
}

const SESSION_STATUS = {
  started: { label: 'En cours', className: 'warn' },
  validated: { label: 'Validée', className: 'success' },
  rejected: { label: 'Refusée', className: 'danger' },
  expired: { label: 'Expirée', className: '' }
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris'
})

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export default async function AdsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const config = getPublicConfig()

  let summary
  let sessions
  try {
    ;[summary, sessions] = await Promise.all([
      getWalletSummary(user.id, {
        transactionLimit: 1,
        referralLimit: 1,
        withdrawalLimit: 1
      }),
      getAdSessions(user.id, 10)
    ])
  } catch (error) {
    console.error('[ads] chargement impossible', {
      code: error?.code,
      message: error?.message
    })

    return (
      <div className="page container">
        <div className="alert error">
          Impossible de charger vos publicités. Vérifiez la configuration Supabase
          et le schéma de base de données.
        </div>
      </div>
    )
  }

  const remainingToday = Math.max(
    0,
    config.dailyAdLimit - summary.validatedAdsToday
  )
  const canWatch = config.adRewardsEnabled && remainingToday > 0

  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <span className="eyebrow">PUBLICITÉS PARTENAIRES</span>
          <h1>Regarder une publicité</h1>
          <p className="page-sub">
            Chaque publicité est vérifiée par la régie avant tout crédit.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/dashboard">
          RETOUR AU PORTEFEUILLE
        </Link>
      </div>

      <div className="ads-grid">
        <section className="card card-pad">
          <div className="reward-highlight">
            <span className="balance-label">Récompense par publicité</span>
            <strong>{formatCents(config.adRewardCents, config.currency)}</strong>
          </div>

          <div className="wallet-stats ads-stats">
            <div className="mini-stat">
              <strong>{summary.validatedAdsToday}</strong>
              <span>Validées aujourd’hui</span>
            </div>
            <div className="mini-stat">
              <strong>{remainingToday}</strong>
              <span>Restantes aujourd’hui</span>
            </div>
            <div className="mini-stat">
              <strong>{config.dailyAdLimit}</strong>
              <span>Limite quotidienne</span>
            </div>
            <div className="mini-stat">
              <strong>{summary.validatedAds}</strong>
              <span>Total validées</span>
            </div>
          </div>

          <div className="ads-action">
            {config.adRewardsEnabled ? (
              <StartAdButton disabled={!canWatch} />
            ) : (
              <div className="alert info">
                Les récompenses publicitaires sont désactivées. Le bouton sera
                disponible dès que la régie partenaire autorisera ce modèle de
                rémunération.
              </div>
            )}

            {config.adRewardsEnabled && remainingToday === 0 ? (
              <div className="alert info">
                Vous avez atteint la limite quotidienne. Revenez demain.
              </div>
            ) : null}
          </div>
        </section>

        <section className="card card-pad">
          <span className="eyebrow">VALIDATION</span>
          <h2 className="card-title">Pourquoi le crédit n’est pas immédiat ?</h2>
          <p className="muted">
            ZNK ADS ne considère jamais un compte à rebours comme une preuve de
            visionnage. La régie partenaire envoie une confirmation signée côté
            serveur. Le montant est alors crédité une seule fois, même si la
            confirmation est renvoyée plusieurs fois.
          </p>
          <ul className="check-list">
            <li>Récompense lue depuis la configuration du serveur.</li>
            <li>Signature HMAC vérifiée avant tout crédit.</li>
            <li>Double crédit impossible grâce à une référence unique.</li>
            <li>Chaque opération enregistrée dans Supabase.</li>
          </ul>
        </section>
      </div>

      <section className="card card-pad section-card">
        <div className="card-head">
          <h2>Vos dernières sessions</h2>
          <span className="badge">{sessions.length} affichée(s)</span>
        </div>

        {sessions.length === 0 ? (
          <p className="empty">
            Aucune session publicitaire pour le moment.
          </p>
        ) : (
          <div className="list">
            {sessions.map((session) => {
              const meta = SESSION_STATUS[session.status] || {
                label: session.status,
                className: ''
              }

              return (
                <div className="list-row" key={session.id}>
                  <div className="list-main">
                    <div className="list-title">{session.provider}</div>
                    <div className="list-sub">
                      {formatDate(session.created_at)} · Référence{' '}
                      {session.provider_reference.slice(0, 12)}…
                    </div>
                  </div>
                  <div className="list-side">
                    <span className={`badge ${meta.className}`}>{meta.label}</span>
                    <span className="amount positive">
                      {formatCents(session.reward_cents, config.currency)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

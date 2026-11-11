import Link from 'next/link'
import { redirect } from 'next/navigation'
import CopyButton from '@/components/CopyButton'
import ReferralList from '@/components/ReferralList'
import TransactionList from '@/components/TransactionList'
import { getCurrentUser } from '@/lib/auth'
import { getPublicConfig } from '@/lib/config'
import { formatCents } from '@/lib/money'
import { getWalletSummary } from '@/lib/wallet'

export const metadata = {
  title: 'Portefeuille'
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const config = getPublicConfig()

  let summary
  try {
    summary = await getWalletSummary(user.id, {
      transactionLimit: 8,
      referralLimit: 5,
      withdrawalLimit: 3
    })
  } catch (error) {
    console.error('[dashboard] chargement impossible', {
      code: error?.code,
      message: error?.message
    })

    return (
      <div className="page container">
        <div className="alert error">
          Impossible de charger votre portefeuille. Vérifiez la configuration
          Supabase et assurez-vous que supabase/schema.sql a bien été exécuté.
        </div>
      </div>
    )
  }

  const referralLink = `${config.siteUrl}/register?ref=${encodeURIComponent(
    user.referral_code
  )}`
  const remainingToday = Math.max(
    0,
    config.dailyAdLimit - summary.validatedAdsToday
  )

  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <span className="eyebrow">TABLEAU DE BORD</span>
          <h1>Bonjour, {user.discord_username}</h1>
          <p className="page-sub">
            Votre solde est mis à jour après chaque validation partenaire.
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-violet" href="/withdraw">
            RETIRER
          </Link>
          <Link className="btn btn-primary" href="/ads">
            REGARDER UNE PUBLICITÉ
          </Link>
        </div>
      </div>

      <div className="wallet-grid">
        <section className="card wallet-main fade-in">
          <div className="wallet-glow" aria-hidden="true" />
          <span className="balance-label">Solde disponible</span>
          <div className="balance-value">
            {formatCents(user.balance_cents, config.currency)}
          </div>
          <p className="balance-sub">
            Total gagné : {formatCents(user.total_earned_cents, config.currency)}
          </p>

          <div className="wallet-actions">
            <Link className="btn btn-primary" href="/ads">
              REGARDER UNE PUBLICITÉ
            </Link>
            <Link className="btn btn-violet" href="/withdraw">
              RETIRER
            </Link>
          </div>

          <div className="wallet-stats">
            <div className="mini-stat">
              <strong>{summary.validatedAds}</strong>
              <span>Publicités validées</span>
            </div>
            <div className="mini-stat">
              <strong>{summary.referralsCount}</strong>
              <span>Parrainages</span>
            </div>
            <div className="mini-stat">
              <strong>
                {summary.validatedAdsToday} / {config.dailyAdLimit}
              </strong>
              <span>Aujourd’hui</span>
            </div>
            <div className="mini-stat">
              <strong>{remainingToday}</strong>
              <span>Restantes aujourd’hui</span>
            </div>
          </div>
        </section>

        <div className="side-stack">
          <section className="card card-pad fade-in">
            <div className="card-head">
              <h2>Parrainage</h2>
              <span className="badge">{summary.referralsCount} filleul(s)</span>
            </div>
            <p className="muted small">
              {formatCents(config.referralSignupRewardCents, config.currency)} par
              inscription, puis{' '}
              {formatCents(config.referralAdRewardCents, config.currency)} lorsque
              votre filleul atteint {config.referralRequiredAds} publicités
              validées.
            </p>

            <div className="code-box">
              <span className="code-label">VOTRE CODE</span>
              <strong>{user.referral_code}</strong>
            </div>

            <div className="copy-row">
              <input
                className="input input-compact"
                readOnly
                value={referralLink}
                aria-label="Lien de parrainage"
              />
              <CopyButton value={referralLink} label="COPIER" compact />
            </div>

            <Link className="text-link" href="#parrainages">
              Voir mes invitations
            </Link>
          </section>

          <section className="card card-pad fade-in">
            <div className="card-head">
              <h2>Dernières transactions</h2>
              <Link className="text-link" href="/withdraw">
                Retraits
              </Link>
            </div>
            <TransactionList
              transactions={summary.transactions}
              currency={config.currency}
              emptyText="Aucune transaction. Regardez votre première publicité."
            />
          </section>
        </div>
      </div>

      <section className="card card-pad section-card" id="parrainages">
        <div className="card-head">
          <div>
            <span className="eyebrow">PARRAINAGE</span>
            <h2>Mes invitations</h2>
          </div>
          <span className="badge">{summary.referralsCount} au total</span>
        </div>
        <ReferralList
          referrals={summary.referrals}
          requiredAds={config.referralRequiredAds}
        />
      </section>
    </div>
  )
}

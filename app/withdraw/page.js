import Link from 'next/link'
import { redirect } from 'next/navigation'
import WithdrawForm from '@/components/WithdrawForm'
import WithdrawalList from '@/components/WithdrawalList'
import { getCurrentUser } from '@/lib/auth'
import { getPublicConfig } from '@/lib/config'
import { formatCents } from '@/lib/money'
import { getWithdrawals } from '@/lib/wallet'

export const metadata = {
  title: 'Retirer'
}

export default async function WithdrawPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const config = getPublicConfig()

  let withdrawals
  try {
    withdrawals = await getWithdrawals(user.id, 25)
  } catch (error) {
    console.error('[withdraw] chargement impossible', {
      code: error?.code,
      message: error?.message
    })

    return (
      <div className="page container">
        <div className="alert error">
          Impossible de charger vos retraits. Vérifiez la configuration Supabase et
          le schéma de base de données.
        </div>
      </div>
    )
  }

  const hasInvite = Boolean(config.discordWithdrawalInviteUrl)

  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <span className="eyebrow">RETRAIT</span>
          <h1>Retirer mes gains</h1>
          <p className="page-sub">
            Les demandes sont traitées manuellement via Discord.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/dashboard">
          RETOUR AU PORTEFEUILLE
        </Link>
      </div>

      <div className="withdraw-grid">
        <section className="card card-pad">
          <span className="balance-label">Solde disponible</span>
          <div className="balance-value balance-value-sm">
            {formatCents(user.balance_cents, config.currency)}
          </div>
          <p className="balance-sub">
            Minimum de retrait :{' '}
            {formatCents(config.minimumWithdrawalCents, config.currency)}
          </p>

          <div className="divider" />

          <WithdrawForm
            balanceCents={user.balance_cents}
            minimumCents={config.minimumWithdrawalCents}
            currency={config.currency}
            enabled={config.withdrawalsEnabled}
          />
        </section>

        <section className="card card-pad">
          <span className="eyebrow">INSTRUCTIONS</span>
          <h2 className="card-title">Comment retirer</h2>

          <div className="instructions">
            <div className="instruction">
              <span className="instruction-num">1</span>
              <p>Vérifiez votre solde disponible et le montant minimum.</p>
            </div>
            <div className="instruction">
              <span className="instruction-num">2</span>
              <p>
                Créez votre demande de retrait sur cette page. Le montant est
                immédiatement réservé sur votre solde.
              </p>
            </div>
            <div className="instruction">
              <span className="instruction-num">3</span>
              <p>
                Ouvrez le Discord ZNK ADS et créez un ticket dans le salon de
                retraits.
              </p>
            </div>
            <div className="instruction">
              <span className="instruction-num">4</span>
              <p>
                Indiquez votre identifiant Discord{' '}
                <strong>{user.discord_id}</strong> et le montant demandé.
              </p>
            </div>
            <div className="instruction">
              <span className="instruction-num">5</span>
              <p>
                Un administrateur traite la demande. Le statut passe de « en
                attente » à « payé », ou « refusé » avec remboursement automatique.
              </p>
            </div>
          </div>

          <div className="divider" />

          {hasInvite ? (
            <a
              className="btn btn-primary btn-block"
              href={config.discordWithdrawalInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              OUVRIR LE DISCORD
            </a>
          ) : (
            <span className="btn btn-primary btn-block btn-disabled" aria-disabled="true">
              DISCORD NON CONFIGURÉ
            </span>
          )}

          <p className="fine-print">
            Un retrait n’est jamais annoncé comme payé avant son traitement
            effectif. Si la demande est refusée, le montant réservé est recrédité.
          </p>
        </section>
      </div>

      <section className="card card-pad section-card">
        <div className="card-head">
          <h2>Historique des demandes</h2>
          <span className="badge">{withdrawals.length} demande(s)</span>
        </div>
        <WithdrawalList withdrawals={withdrawals} currency={config.currency} />
      </section>
    </div>
  )
}

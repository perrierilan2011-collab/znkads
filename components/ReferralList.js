const STATUS_META = {
  pending: { label: 'En attente', className: '' },
  signup_paid: { label: 'Inscription payée', className: 'success' },
  completed: { label: 'Complété', className: 'success' }
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Paris'
})

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export default function ReferralList({ referrals, requiredAds }) {
  if (!referrals?.length) {
    return (
      <p className="empty">
        Aucune invitation pour le moment. Partagez votre lien pour commencer.
      </p>
    )
  }

  return (
    <div className="list">
      {referrals.map((referral) => {
        const referred = Array.isArray(referral.referred)
          ? referral.referred[0]
          : referral.referred
        const meta = STATUS_META[referral.status] || {
          label: referral.status,
          className: ''
        }

        return (
          <div className="list-row" key={referral.id}>
            <div className="list-main">
              <div className="list-title">
                {referred?.discord_username || 'Utilisateur Discord'}
              </div>
              <div className="list-sub">
                {formatDate(referral.created_at)} · Inscription{' '}
                {referral.signup_reward_paid ? 'payée' : 'en attente'} · Palier{' '}
                {referral.ad_reward_paid
                  ? 'atteint'
                  : `${requiredAds} publicités requises`}
              </div>
            </div>
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}

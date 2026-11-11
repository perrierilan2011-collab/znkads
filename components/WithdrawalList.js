import { formatCents } from '@/lib/money'

const STATUS_META = {
  pending: { label: 'En attente', className: 'warn' },
  processing: { label: 'En cours', className: 'warn' },
  accepted: { label: 'Accepté', className: 'success' },
  rejected: { label: 'Refusé', className: 'danger' },
  paid: { label: 'Payé', className: 'success' }
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

export default function WithdrawalList({ withdrawals, currency }) {
  if (!withdrawals?.length) {
    return <p className="empty">Aucune demande de retrait pour le moment.</p>
  }

  return (
    <div className="list">
      {withdrawals.map((withdrawal) => {
        const meta = STATUS_META[withdrawal.status] || {
          label: withdrawal.status,
          className: ''
        }

        return (
          <div className="list-row" key={withdrawal.id}>
            <div className="list-main">
              <div className="list-title">
                {formatCents(withdrawal.amount_cents, currency)}
              </div>
              <div className="list-sub">
                {formatDate(withdrawal.created_at)} · Discord {withdrawal.discord_id}
              </div>
            </div>
            <span className={`badge ${meta.className}`}>{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}

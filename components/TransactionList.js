import { formatCents } from '@/lib/money'

const TYPE_LABELS = {
  ad_reward: 'Publicité validée',
  referral_signup: 'Bonus de parrainage',
  referral_ad: 'Palier de parrainage',
  withdrawal_request: 'Demande de retrait',
  withdrawal_refund: 'Remboursement de retrait',
  adjustment: 'Ajustement'
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

export default function TransactionList({
  transactions,
  currency,
  emptyText = 'Aucune transaction pour le moment.'
}) {
  if (!transactions?.length) {
    return <p className="empty">{emptyText}</p>
  }

  return (
    <div className="list">
      {transactions.map((transaction) => {
        const positive = transaction.amount_cents > 0

        return (
          <div className="list-row" key={transaction.id}>
            <div className="list-main">
              <div className="list-title">
                {TYPE_LABELS[transaction.type] || transaction.type}
              </div>
              <div className="list-sub">
                {formatDate(transaction.created_at)}
                {transaction.description ? ` · ${transaction.description}` : ''}
              </div>
            </div>
            <span className={`amount ${positive ? 'positive' : 'negative'}`}>
              {positive ? '+' : ''}
              {formatCents(transaction.amount_cents, currency)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

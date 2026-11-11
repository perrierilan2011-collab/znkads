/**
 * Utilitaires monetaires.
 * Tous les montants sont manipules en centimes entiers (bigint cote base,
 * number cote JS tant que l'on reste sous Number.MAX_SAFE_INTEGER).
 */

const AMOUNT_PATTERN = /^\d+(?:[.,]\d{1,2})?$/

/**
 * Convertit une chaine decimale ("5", "5.00", "0,02") en centimes entiers.
 * Retourne null si le format est invalide.
 * Aucun calcul flottant n'est effectue.
 */
export function parseAmountToCents(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    value = value.toFixed(2)
  }

  const raw = String(value ?? '').trim()
  if (!AMOUNT_PATTERN.test(raw)) return null

  const normalized = raw.replace(',', '.')
  const [eurosPart, decimalsPart = ''] = normalized.split('.')
  const euros = Number(eurosPart)
  const cents = Number((decimalsPart + '00').slice(0, 2))

  if (!Number.isSafeInteger(euros) || !Number.isSafeInteger(cents)) return null

  const total = euros * 100 + cents
  return Number.isSafeInteger(total) ? total : null
}

/**
 * Formate des centimes en montant lisible.
 */
export function formatCents(cents, currency = 'EUR', locale = 'fr-FR') {
  const safeCents = Number.isFinite(Number(cents)) ? Number(cents) : 0
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeCents / 100)
  } catch {
    return `${(safeCents / 100).toFixed(2)} ${currency}`
  }
}

/**
 * Convertit des centimes en chaine decimale sans symbole monetaire.
 */
export function centsToAmountString(cents) {
  const safeCents = Math.max(0, Math.trunc(Number(cents) || 0))
  const euros = Math.floor(safeCents / 100)
  const rest = String(safeCents % 100).padStart(2, '0')
  return `${euros}.${rest}`
}

/**
 * Verifie qu'un montant en centimes est un entier positif sur.
 */
export function isValidCents(value) {
  return Number.isSafeInteger(value) && value > 0
}

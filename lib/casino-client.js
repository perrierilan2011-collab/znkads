/**
 * Helpers navigateur du casino.
 * Aucune logique de resultat : le serveur decide toujours.
 */

import { parseAmountToCents } from '@/lib/money'

export async function casinoPost(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-znk-csrf': '1'
    },
    body: JSON.stringify(payload)
  })

  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.ok) {
    const error = new Error(data?.message || 'Le casino est momentanément indisponible.')
    error.code = data?.error || 'CASINO_ERROR'
    error.status = response.status
    throw error
  }

  return data
}

export function betToCents(value) {
  return parseAmountToCents(value)
}

export function clampBetInput(value, minCents, maxCents, balanceCents) {
  const parsed = parseAmountToCents(value)
  if (parsed === null) return null

  const ceiling = Math.max(
    0,
    Math.min(Number(maxCents) || 0, Number(balanceCents) || 0)
  )

  if (parsed < minCents) return minCents
  if (parsed > ceiling) return ceiling
  return parsed
}

export function formatMultiplier(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '×1.00'
  return `×${number.toFixed(2)}`
}

export function gameName(games, id) {
  return games?.find((game) => game.id === id)?.name || id
}

export function gameAccent(games, id) {
  return games?.find((game) => game.id === id)?.accent || '#8b5cf6'
}

export function isRedCard(card) {
  return card?.s === '♥' || card?.s === '♦'
}

export function cardLabel(card) {
  if (!card) return '?'
  return `${card.r}${card.s}`
}

/**
 * lib/casino.js
 * Moteur de casino 100% serveur.
 *
 * Regles :
 * - Aucun resultat n'est calcule dans le navigateur.
 * - Le solde est debite au demarrage de la partie et credite a la fin.
 * - Les jeux a etats (blackjack, mines) sont stockes en base avec un numero
 *   de version pour empecher deux actions concurrentes.
 * - Les positions des mines et le sabot du blackjack ne quittent jamais le serveur.
 */

import crypto from 'node:crypto'
import { getConfig } from './config'
import { getSupabaseAdmin } from './supabase'
import { AppError } from './errors'
import { parseAmountToCents } from './money'
import { ROULETTE_WHEEL, rouletteColor } from './casino-constants'

export const CASINO_GAMES = [
  {
    id: 'slots',
    name: 'PUFF & PUFF',
    tagline: 'Machine à sous',
    description: '5 lignes, 7 symboles. Jusqu’à 100× la mise.',
    emoji: '☁️',
    accent: '#a78bfa'
  },
  {
    id: 'blackjack',
    name: 'BLACKJACK',
    tagline: '21',
    description: 'Approchez 21 sans dépasser. Le croupier reste à 17.',
    emoji: '♠️',
    accent: '#8b5cf6'
  },
  {
    id: 'roulette',
    name: 'ROULETTE',
    tagline: 'Européenne',
    description: '37 numéros, un seul zéro. Jusqu’à 36× la mise.',
    emoji: '🎡',
    accent: '#f472b6'
  },
  {
    id: 'mines',
    name: 'MINES',
    tagline: '5 × 5',
    description: 'Révélez les cases sûres et encaissez avant la bombe.',
    emoji: '💣',
    accent: '#fb7185'
  },
  {
    id: 'coinflip',
    name: 'PILE OU FACE',
    tagline: '×1.96',
    description: 'Un lancer, deux issues. 98% de retour joueur.',
    emoji: '🪙',
    accent: '#fbbf24'
  },
  {
    id: 'dice',
    name: 'DÉS',
    tagline: '1 – 100',
    description: 'Au-dessus ou en dessous. Ajustez votre risque.',
    emoji: '🎲',
    accent: '#34d399'
  }
]

export function getCasinoConfig() {
  const config = getConfig()
  return {
    enabled: config.casinoEnabled,
    min_bet_cents: config.casinoMinBetCents,
    max_bet_cents: config.casinoMaxBetCents,
    currency: config.currency,
    games: CASINO_GAMES
  }
}

export function assertCasinoEnabled() {
  if (!getConfig().casinoEnabled) {
    throw new AppError('Le casino est désactivé.', {
      status: 403,
      code: 'CASINO_DISABLED'
    })
  }
}

/**
 * Valide une mise envoyee par le client (en euros) et retourne des centimes.
 */
export function parseBet(value) {
  const config = getConfig()
  const cents = parseAmountToCents(value)

  if (cents === null || cents <= 0) {
    throw new AppError('Mise invalide.', { status: 400, code: 'INVALID_BET' })
  }

  if (cents < config.casinoMinBetCents) {
    throw new AppError(
      `Mise minimale : ${(config.casinoMinBetCents / 100).toFixed(2)} ${config.currency}.`,
      { status: 400, code: 'BET_TOO_LOW' }
    )
  }

  if (cents > config.casinoMaxBetCents) {
    throw new AppError(
      `Mise maximale : ${(config.casinoMaxBetCents / 100).toFixed(2)} ${config.currency}.`,
      { status: 400, code: 'BET_TOO_HIGH' }
    )
  }

  return cents
}

/* ------------------------------------------------------------------ */
/* Aleatoire cryptographique                                           */
/* ------------------------------------------------------------------ */

function secureInt(maxExclusive) {
  return crypto.randomInt(maxExclusive)
}

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = secureInt(total)
  for (const item of items) {
    roll -= item.weight
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

/* ------------------------------------------------------------------ */
/* Base de donnees                                                     */
/* ------------------------------------------------------------------ */

const DB_ERRORS = {
  insufficient_balance: [400, 'INSUFFICIENT_BALANCE', 'Solde insuffisant.'],
  user_not_found: [404, 'USER_NOT_FOUND', 'Utilisateur introuvable.'],
  round_not_found: [404, 'ROUND_NOT_FOUND', 'Partie introuvable.'],
  round_not_active: [409, 'ROUND_NOT_ACTIVE', 'Cette partie est déjà terminée.'],
  round_already_active: [
    409,
    'ROUND_ALREADY_ACTIVE',
    'Une partie de ce jeu est déjà en cours. Terminez-la d’abord.'
  ],
  casino_rounds_one_active_idx: [
    409,
    'ROUND_ALREADY_ACTIVE',
    'Une partie de ce jeu est déjà en cours. Terminez-la d’abord.'
  ],
  round_conflict: [
    409,
    'ROUND_CONFLICT',
    'Action déjà prise en compte. Rechargez la partie.'
  ],
  invalid_amount: [400, 'INVALID_AMOUNT', 'Montant invalide.'],
  invalid_game: [400, 'INVALID_GAME', 'Jeu invalide.'],
  invalid_status: [400, 'INVALID_STATUS', 'Statut invalide.']
}

function mapDbError(error) {
  const message = String(error?.message || '')

  for (const [key, [status, code, text]] of Object.entries(DB_ERRORS)) {
    if (message.includes(key)) return new AppError(text, { status, code })
  }

  if (message.includes('invalid input syntax for type uuid')) {
    return new AppError('Identifiant invalide.', {
      status: 400,
      code: 'INVALID_ROUND_ID'
    })
  }

  if (message.includes('Could not find the table') || error?.code === 'PGRST205') {
    return new AppError(
      'Le schéma casino n’est pas installé. Exécutez supabase/schema.sql.',
      { status: 503, code: 'CASINO_NOT_INSTALLED' }
    )
  }

  console.error('[casino] erreur base', {
    code: error?.code,
    message,
    details: error?.details
  })
  return new AppError('Le casino est momentanément indisponible.', {
    status: 500,
    code: 'CASINO_ERROR'
  })
}

async function rpc(name, params) {
  const { data, error } = await getSupabaseAdmin().rpc(name, params)
  if (error) throw mapDbError(error)
  return data
}

export async function playInstant({ userId, game, betCents, payoutCents, result }) {
  return rpc('casino_instant_bet', {
    p_user_id: userId,
    p_game: game,
    p_bet_cents: betCents,
    p_payout_cents: payoutCents,
    p_result: result
  })
}

export async function startCasinoRound({ userId, game, betCents, state }) {
  return rpc('casino_start_round', {
    p_user_id: userId,
    p_game: game,
    p_bet_cents: betCents,
    p_state: state
  })
}

export async function updateCasinoRound({ roundId, userId, state, version }) {
  return rpc('casino_update_round', {
    p_round_id: roundId,
    p_user_id: userId,
    p_state: state,
    p_version: version
  })
}

export async function raiseCasinoBet({ roundId, userId, extraCents }) {
  return rpc('casino_raise_bet', {
    p_round_id: roundId,
    p_user_id: userId,
    p_extra_cents: extraCents
  })
}

export async function finishCasinoRound({
  roundId,
  userId,
  payoutCents,
  status,
  result,
  version
}) {
  return rpc('casino_finish_round', {
    p_round_id: roundId,
    p_user_id: userId,
    p_payout_cents: payoutCents,
    p_status: status,
    p_result: result,
    p_version: version
  })
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getCasinoRound(userId, roundId, game) {
  if (!UUID_PATTERN.test(String(roundId || ''))) {
    throw new AppError('Identifiant de partie invalide.', {
      status: 400,
      code: 'INVALID_ROUND_ID'
    })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('casino_rounds')
    .select('*')
    .eq('id', roundId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw mapDbError(error)

  if (!data) {
    throw new AppError('Partie introuvable.', {
      status: 404,
      code: 'ROUND_NOT_FOUND'
    })
  }

  if (game && data.game !== game) {
    throw new AppError('Cette partie ne correspond pas au jeu demandé.', {
      status: 400,
      code: 'WRONG_GAME'
    })
  }

  return data
}

export async function getCasinoStats(userId) {
  return rpc('casino_user_stats', { p_user_id: userId })
}

export async function getRecentWins(limit = 8) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('casino_rounds')
    .select('game, bet_cents, payout_cents, updated_at, users(discord_username)')
    .eq('status', 'won')
    .gte('payout_cents', 200)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20))

  if (error) throw mapDbError(error)

  return (data || []).map((row) => {
    const username = row.users?.discord_username || 'Joueur'
    return {
      game: row.game,
      bet_cents: row.bet_cents,
      payout_cents: row.payout_cents,
      updated_at: row.updated_at,
      username: `${String(username).slice(0, 3)}***`
    }
  })
}

export async function getCasinoState(userId) {
  const supabase = getSupabaseAdmin()

  const [stats, roundsResult, feed] = await Promise.all([
    getCasinoStats(userId),
    supabase
      .from('casino_rounds')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active'),
    getRecentWins(8)
  ])

  if (roundsResult.error) throw mapDbError(roundsResult.error)

  const rounds = roundsResult.data || []
  const blackjack = rounds.find((round) => round.game === 'blackjack')
  const mines = rounds.find((round) => round.game === 'mines')

  return {
    stats,
    feed,
    active: {
      blackjack: blackjack ? publicBlackjackRound(blackjack) : null,
      mines: mines ? publicMinesRound(mines) : null
    }
  }
}

/* ------------------------------------------------------------------ */
/* ROULETTE                                                            */
/* ------------------------------------------------------------------ */

const ROULETTE_BET_TYPES = new Set([
  'number',
  'red',
  'black',
  'even',
  'odd',
  'low',
  'high',
  'dozen',
  'column'
])

export function spinRoulette(betCents, betType, betValue) {
  if (!ROULETTE_BET_TYPES.has(betType)) {
    throw new AppError('Type de mise invalide.', {
      status: 400,
      code: 'INVALID_BET_TYPE'
    })
  }

  if (betType === 'number') {
    const value = Number(betValue)
    if (!Number.isInteger(value) || value < 0 || value > 36) {
      throw new AppError('Numéro invalide.', {
        status: 400,
        code: 'INVALID_NUMBER'
      })
    }
  }

  if (betType === 'dozen' || betType === 'column') {
    const value = Number(betValue)
    if (![1, 2, 3].includes(value)) {
      throw new AppError('Sélection invalide.', {
        status: 400,
        code: 'INVALID_SELECTION'
      })
    }
  }

  const number = ROULETTE_WHEEL[secureInt(37)]
  const color = rouletteColor(number)

  let win = false
  let multiplier = 0

  switch (betType) {
    case 'number':
      win = number === Number(betValue)
      multiplier = 36
      break
    case 'red':
      win = color === 'red'
      multiplier = 2
      break
    case 'black':
      win = color === 'black'
      multiplier = 2
      break
    case 'even':
      win = number !== 0 && number % 2 === 0
      multiplier = 2
      break
    case 'odd':
      win = number % 2 === 1
      multiplier = 2
      break
    case 'low':
      win = number >= 1 && number <= 18
      multiplier = 2
      break
    case 'high':
      win = number >= 19
      multiplier = 2
      break
    case 'dozen': {
      const dozen = Number(betValue)
      win = number >= (dozen - 1) * 12 + 1 && number <= dozen * 12
      multiplier = 3
      break
    }
    case 'column': {
      const column = Number(betValue)
      const expected = column === 1 ? 1 : column === 2 ? 2 : 0
      win = number > 0 && number % 3 === expected
      multiplier = 3
      break
    }
  }

  const payoutCents = win ? betCents * multiplier : 0

  return {
    payoutCents,
    result: {
      game: 'roulette',
      number,
      color,
      bet_type: betType,
      bet_value: betValue ?? null,
      win,
      multiplier,
      payout_cents: payoutCents
    }
  }
}

/* ------------------------------------------------------------------ */
/* MACHINE A SOUS                                                      */
/* ------------------------------------------------------------------ */

const SLOT_SYMBOLS = [
  { id: 'cherry', emoji: '🍒', weight: 34, pay3: 2 },
  { id: 'lemon', emoji: '🍋', weight: 26, pay3: 3 },
  { id: 'bell', emoji: '🔔', weight: 18, pay3: 5 },
  { id: 'star', emoji: '⭐', weight: 12, pay3: 9 },
  { id: 'cloud', emoji: '☁️', weight: 6, pay3: 20 },
  { id: 'diamond', emoji: '💎', weight: 3, pay3: 40 },
  { id: 'seven', emoji: '7️⃣', weight: 1, pay3: 100 }
]

const SLOT_PAYLINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 4, 8],
  [2, 4, 6]
]

export function spinSlots(betCents) {
  const cells = Array.from({ length: 9 }, () => pickWeighted(SLOT_SYMBOLS))
  const lineBet = betCents / SLOT_PAYLINES.length
  let total = 0

  const lines = SLOT_PAYLINES.map((cellsIndexes, index) => {
    const [a, b, c] = cellsIndexes.map((cellIndex) => cells[cellIndex].id)

    if (a === b && b === c) {
      const symbol = cells[cellsIndexes[0]]
      total += lineBet * symbol.pay3
      return {
        index,
        cells: cellsIndexes,
        symbol: symbol.id,
        emoji: symbol.emoji,
        multiplier: symbol.pay3,
        win: true
      }
    }

    return { index, cells: cellsIndexes, win: false }
  })

  const payoutCents = Math.floor(total)

  return {
    payoutCents,
    result: {
      game: 'slots',
      grid: cells.map((symbol) => symbol.id),
      emojis: cells.map((symbol) => symbol.emoji),
      lines,
      win: payoutCents > 0,
      payout_cents: payoutCents
    }
  }
}

/* ------------------------------------------------------------------ */
/* PILE OU FACE                                                        */
/* ------------------------------------------------------------------ */

export function flipCoin(betCents, choice) {
  if (choice !== 'heads' && choice !== 'tails') {
    throw new AppError('Choisissez pile ou face.', {
      status: 400,
      code: 'INVALID_CHOICE'
    })
  }

  const outcome = secureInt(2) === 0 ? 'heads' : 'tails'
  const win = outcome === choice
  const payoutCents = win ? Math.floor((betCents * 196) / 100) : 0

  return {
    payoutCents,
    result: {
      game: 'coinflip',
      choice,
      outcome,
      win,
      multiplier: 1.96,
      payout_cents: payoutCents
    }
  }
}

/* ------------------------------------------------------------------ */
/* DES                                                                 */
/* ------------------------------------------------------------------ */

export function rollDice(betCents, direction, target) {
  if (direction !== 'over' && direction !== 'under') {
    throw new AppError('Sens de mise invalide.', {
      status: 400,
      code: 'INVALID_DIRECTION'
    })
  }

  const value = Number(target)
  if (!Number.isInteger(value) || value < 2 || value > 98) {
    throw new AppError('La cible doit être comprise entre 2 et 98.', {
      status: 400,
      code: 'INVALID_TARGET'
    })
  }

  const roll = secureInt(100) + 1
  const win = direction === 'over' ? roll > value : roll < value
  const chancePercent = direction === 'over' ? 100 - value : value - 1
  const multiplier = Math.round((98 / chancePercent) * 100) / 100
  const payoutCents = win ? Math.floor((betCents * 98) / chancePercent) : 0

  return {
    payoutCents,
    result: {
      game: 'dice',
      direction,
      target: value,
      roll,
      win,
      multiplier,
      payout_cents: payoutCents
    }
  }
}

/* ------------------------------------------------------------------ */
/* MINES                                                               */
/* ------------------------------------------------------------------ */

export function minesMultiplier(mineCount, picks) {
  if (picks <= 0) return 1

  const safeCells = 25 - mineCount
  let probability = 1

  for (let index = 0; index < picks; index += 1) {
    probability *= (safeCells - index) / (25 - index)
  }

  // 3% d'avantage maison.
  return Math.floor((0.97 / probability) * 100) / 100
}

export function createMinesState(mineCount) {
  const mines = new Set()

  while (mines.size < mineCount) {
    mines.add(secureInt(25))
  }

  return {
    mineCount,
    mines: [...mines].sort((left, right) => left - right),
    revealed: []
  }
}

export function publicMinesRound(round) {
  const state = round.state || {}
  const revealed = Array.isArray(state.revealed) ? state.revealed : []
  const mineCount = state.mineCount || 3
  const multiplier = minesMultiplier(mineCount, revealed.length)
  const safeCells = 25 - mineCount
  const finished = round.status !== 'active'
  const result = round.result || {}
  const mines = finished
    ? Array.isArray(result.mines)
      ? result.mines
      : Array.isArray(state.mines)
        ? state.mines
        : []
    : null

  return {
    id: round.id,
    bet_cents: round.bet_cents,
    version: round.version,
    mine_count: mineCount,
    revealed,
    mines,
    hit_cell: Number.isInteger(result.mine) ? result.mine : null,
    multiplier,
    next_multiplier: minesMultiplier(mineCount, revealed.length + 1),
    payout_cents: finished
      ? round.payout_cents || 0
      : Math.floor(round.bet_cents * multiplier),
    safe_left: Math.max(0, safeCells - revealed.length),
    status: round.status,
    result
  }
}

/* ------------------------------------------------------------------ */
/* BLACKJACK                                                           */
/* ------------------------------------------------------------------ */

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function buildShoe(decks = 6) {
  const cards = []

  for (let deck = 0; deck < decks; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ r: rank, s: suit })
      }
    }
  }

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = secureInt(index + 1)
    const temp = cards[index]
    cards[index] = cards[swap]
    cards[swap] = temp
  }

  return cards
}

function cardValue(card) {
  if (card.r === 'A') return 11
  if (card.r === 'J' || card.r === 'Q' || card.r === 'K') return 10
  return Number(card.r)
}

export function handValue(cards = []) {
  let total = 0
  let aces = 0

  for (const card of cards) {
    total += cardValue(card)
    if (card.r === 'A') aces += 1
  }

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  return { total, soft: aces > 0 && total <= 21 }
}

function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21
}

export function startBlackjack(betCents) {
  const deck = buildShoe()
  const player = [deck.pop(), deck.pop()]
  const dealer = [deck.pop(), deck.pop()]

  const state = { deck, player, dealer, betCents, doubled: false }

  const playerBlackjack = isBlackjack(player)
  const dealerBlackjack = isBlackjack(dealer)

  if (!playerBlackjack && !dealerBlackjack) {
    return { state, finished: false }
  }

  if (playerBlackjack && dealerBlackjack) {
    return {
      state,
      finished: true,
      payoutCents: betCents,
      status: 'push',
      outcome: 'push'
    }
  }

  if (playerBlackjack) {
    return {
      state,
      finished: true,
      payoutCents: Math.floor(betCents * 2.5),
      status: 'won',
      outcome: 'blackjack'
    }
  }

  return { state, finished: true, payoutCents: 0, status: 'lost', outcome: 'lose' }
}

function settleBlackjack(state) {
  const player = handValue(state.player).total
  const dealer = handValue(state.dealer).total

  if (dealer > 21 || player > dealer) {
    return {
      state,
      finished: true,
      payoutCents: state.betCents * 2,
      status: 'won',
      outcome: 'win'
    }
  }

  if (player === dealer) {
    return {
      state,
      finished: true,
      payoutCents: state.betCents,
      status: 'push',
      outcome: 'push'
    }
  }

  return { state, finished: true, payoutCents: 0, status: 'lost', outcome: 'lose' }
}

export function actBlackjack(state, action) {
  const next = JSON.parse(JSON.stringify(state))

  if (action === 'hit') {
    next.player.push(next.deck.pop())

    if (handValue(next.player).total > 21) {
      return {
        state: next,
        finished: true,
        payoutCents: 0,
        status: 'lost',
        outcome: 'bust'
      }
    }

    return { state: next, finished: false }
  }

  if (action === 'stand') {
    while (handValue(next.dealer).total < 17) {
      next.dealer.push(next.deck.pop())
    }
    return settleBlackjack(next)
  }

  if (action === 'double') {
    if (next.player.length !== 2 || next.doubled) {
      throw new AppError('Le double n’est pas disponible.', {
        status: 400,
        code: 'DOUBLE_NOT_ALLOWED'
      })
    }

    next.doubled = true
    next.player.push(next.deck.pop())

    if (handValue(next.player).total > 21) {
      return {
        state: next,
        finished: true,
        payoutCents: 0,
        status: 'lost',
        outcome: 'bust'
      }
    }

    while (handValue(next.dealer).total < 17) {
      next.dealer.push(next.deck.pop())
    }

    return settleBlackjack(next)
  }

  throw new AppError('Action invalide.', {
    status: 400,
    code: 'INVALID_ACTION'
  })
}

export function publicBlackjackRound(round) {
  const state = round.state || {}
  const player = state.player || []
  const dealer = state.dealer || []
  const finished = round.status !== 'active'
  const visibleDealer = finished ? dealer : dealer.slice(0, 1)
  const playerValue = handValue(player)
  const dealerValue = handValue(visibleDealer)

  return {
    id: round.id,
    bet_cents: round.bet_cents,
    version: round.version,
    player,
    dealer: visibleDealer,
    player_total: playerValue.total,
    player_soft: playerValue.soft,
    dealer_total: dealerValue.total,
    dealer_hidden: !finished,
    doubled: Boolean(state.doubled),
    can_double: !finished && player.length === 2 && !state.doubled,
    status: round.status,
    outcome: round.result?.outcome || null,
    payout_cents: round.payout_cents,
    result: round.result || {}
  }
}

/**
 * Construit le resultat final d'une main de blackjack.
 */
export function blackjackResultPayload(state, outcome) {
  return {
    outcome,
    player: state.player,
    dealer: state.dealer,
    player_total: handValue(state.player).total,
    dealer_total: handValue(state.dealer).total
  }
}

/**
 * lib/casino-constants.js
 * Constantes de jeu partagees entre le serveur et le navigateur.
 * Aucune logique financiere ici : uniquement de l'affichage.
 */

// Ordre europeen reel, dans le sens horaire.
export const ROULETTE_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
]

export const ROULETTE_RED = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]

const RED_SET = new Set(ROULETTE_RED)

export function rouletteColor(number) {
  if (number === 0) return 'green'
  return RED_SET.has(number) ? 'red' : 'black'
}

export const CARD_SUITS = ['♠', '♥', '♦', '♣']
export const CARD_RANKS = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'
]

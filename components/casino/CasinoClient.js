'use client'

import { useCallback, useEffect, useState } from 'react'
import BlackjackGame from './BlackjackGame'
import CoinFlipGame from './CoinFlipGame'
import DiceGame from './DiceGame'
import MinesGame from './MinesGame'
import RouletteGame from './RouletteGame'
import SlotsGame from './SlotsGame'
import WinBurst from './WinBurst'
import { formatCents } from '@/lib/money'
import { playSound } from './sound'

const AGE_KEY = 'znk_casino_18'
const SOUND_KEY = 'znk_casino_sound'

function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export default function CasinoClient({
  username,
  initialBalanceCents,
  initialStats,
  initialFeed,
  initialActive,
  config
}) {
  const [ready, setReady] = useState(false)
  const [adult, setAdult] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [gameId, setGameId] = useState('slots')
  const [balance, setBalance] = useState(initialBalanceCents)
  const [active, setActive] = useState(initialActive || {})
  const [win, setWin] = useState(null)
  const [session, setSession] = useState({ rounds: 0, wagered: 0, net: 0 })

  useEffect(() => {
    setAdult(readStorage(AGE_KEY) === '1')
    setSoundOn(readStorage(SOUND_KEY) !== '0')
    setReady(true)
  }, [])

  const confirmAdult = useCallback(() => {
    writeStorage(AGE_KEY, '1')
    setAdult(true)
  }, [])

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      writeStorage(SOUND_KEY, current ? '0' : '1')
      return !current
    })
  }, [])

  const handleSettle = useCallback(
    ({ bet_cents: bet, payout_cents: payout, balance_cents: nextBalance }) => {
      if (Number.isFinite(nextBalance)) setBalance(nextBalance)

      setSession((current) => ({
        rounds: current.rounds + 1,
        wagered: current.wagered + (bet || 0),
        net: current.net + ((payout || 0) - (bet || 0))
      }))

      if (payout > bet && bet > 0) {
        const ratio = payout / bet
        setWin({
          amount_cents: payout,
          multiplier: `×${ratio.toFixed(2)}`,
          label: ratio >= 10 ? 'GROS GAIN' : 'GAIN'
        })
      }
    },
    []
  )

  const handleActiveChange = useCallback((game, round) => {
    setActive((current) => ({ ...current, [game]: round }))
  }, [])

  const closeWin = useCallback(() => setWin(null), [])

  if (!ready) return null

  if (!adult) {
    return (
      <div className="casino-gate card card-pad">
        <span className="eyebrow">CASINO</span>
        <h1>Réservé aux adultes</h1>
        <p className="page-sub">
          Le casino utilise votre solde réel. Vous pouvez perdre tout ou partie
          de ce que vous misez. Ne jouez que ce que vous pouvez vous permettre
          de perdre.
        </p>
        <p className="fine-print">
          Besoin d’aide ? Joueurs Info Service : 09 74 75 13 13 (appel non
          surtaxé).
        </p>
        <div className="casino-gate-actions">
          <button type="button" className="btn btn-primary" onClick={confirmAdult}>
            J’AI 18 ANS OU PLUS
          </button>
          <a className="btn btn-ghost" href="/dashboard">
            RETOUR
          </a>
        </div>
      </div>
    )
  }

  const games = config.games
  const current = games.find((game) => game.id === gameId) || games[0]
  const stats = initialStats || {}

  const gameProps = {
    config,
    balanceCents: balance,
    onSettle: handleSettle,
    soundOn
  }

  let gameNode = null
  switch (current.id) {
    case 'slots':
      gameNode = <SlotsGame {...gameProps} />
      break
    case 'blackjack':
      gameNode = (
        <BlackjackGame
          {...gameProps}
          initialRound={active.blackjack || null}
          onBalance={setBalance}
          onActiveChange={handleActiveChange}
        />
      )
      break
    case 'roulette':
      gameNode = <RouletteGame {...gameProps} />
      break
    case 'mines':
      gameNode = (
        <MinesGame
          {...gameProps}
          initialRound={active.mines || null}
          onBalance={setBalance}
          onActiveChange={handleActiveChange}
        />
      )
      break
    case 'coinflip':
      gameNode = <CoinFlipGame {...gameProps} />
      break
    case 'dice':
      gameNode = <DiceGame {...gameProps} />
      break
    default:
      gameNode = null
  }

  return (
    <div className="casino fade-in">
      <div className="page-head">
        <div>
          <span className="eyebrow">CASINO</span>
          <h1>Bonne chance, {username}</h1>
          <p className="page-sub">
            Jouez avec votre solde. Tous les résultats sont tirés côté serveur.
          </p>
        </div>

        <div className="casino-balance">
          <span className="balance-label">Solde</span>
          <strong>{formatCents(balance, config.currency)}</strong>
          <button
            type="button"
            className="casino-sound"
            onClick={() => {
              toggleSound()
              playSound('click', !soundOn)
            }}
            aria-pressed={soundOn}
          >
            {soundOn ? '🔊 Son' : '🔇 Son coupé'}
          </button>
        </div>
      </div>

      <div className="casino-lobby" role="tablist" aria-label="Jeux du casino">
        {games.map((game) => {
          const inProgress = Boolean(active?.[game.id])
          return (
            <button
              key={game.id}
              type="button"
              role="tab"
              aria-selected={game.id === current.id}
              className={`lobby-tile ${game.id === current.id ? 'active' : ''}`}
              style={{ '--accent': game.accent }}
              onClick={() => {
                setGameId(game.id)
                playSound('click', soundOn)
              }}
            >
              <span className="lobby-emoji" aria-hidden="true">
                {game.emoji}
              </span>
              <strong>{game.name}</strong>
              <span className="lobby-tag">{game.tagline}</span>
              {inProgress ? <span className="lobby-live">EN COURS</span> : null}
            </button>
          )
        })}
      </div>

      <div className="casino-layout">
        <section
          className="card game-panel"
          style={{ '--accent': current.accent }}
          aria-label={current.name}
        >
          <div className="game-panel-head">
            <div>
              <h2>
                {current.emoji} {current.name}
              </h2>
              <p>{current.description}</p>
            </div>
          </div>
          {gameNode}
        </section>

        <aside className="casino-side">
          <div className="card card-pad">
            <h3 className="card-title">Cette session</h3>
            <div className="casino-stats">
              <div>
                <span>Parties</span>
                <strong>{session.rounds}</strong>
              </div>
              <div>
                <span>Misé</span>
                <strong>{formatCents(session.wagered, config.currency)}</strong>
              </div>
              <div>
                <span>Résultat</span>
                <strong className={session.net >= 0 ? 'pos' : 'neg'}>
                  {session.net >= 0 ? '+' : ''}
                  {formatCents(session.net, config.currency)}
                </strong>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="card-title">Mon historique</h3>
            <div className="casino-stats">
              <div>
                <span>Parties jouées</span>
                <strong>{stats.rounds ?? 0}</strong>
              </div>
              <div>
                <span>Plus gros gain</span>
                <strong>
                  {formatCents(stats.biggest_win_cents ?? 0, config.currency)}
                </strong>
              </div>
              <div>
                <span>Bilan total</span>
                <strong className={(stats.net_cents ?? 0) >= 0 ? 'pos' : 'neg'}>
                  {formatCents(stats.net_cents ?? 0, config.currency)}
                </strong>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="card-title">Derniers gros gains</h3>
            {initialFeed?.length ? (
              <ul className="casino-feed">
                {initialFeed.map((item, index) => (
                  <li key={`${item.updated_at}-${index}`}>
                    <span>{item.username}</span>
                    <span className="feed-game">{item.game}</span>
                    <strong>{formatCents(item.payout_cents, config.currency)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Aucun gain récent.</p>
            )}
          </div>
        </aside>
      </div>

      <p className="fine-print casino-footnote">
        Jeu réservé aux +18 ans. Jouer comporte des risques : endettement,
        isolement, dépendance. Besoin d’aide ? Joueurs Info Service :
        09 74 75 13 13.
      </p>

      <WinBurst win={win} currency={config.currency} onDone={closeWin} />
    </div>
  )
}

/**
 * Discord OAuth2 (scope identify uniquement).
 * Le client secret reste exclusivement cote serveur.
 */

import { getConfig, requireEnv } from './config'
import { AppError } from './errors'

const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize'

export function buildAuthorizeUrl(state) {
  const config = requireEnv([
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI'
  ])

  const params = new URLSearchParams({
    client_id: config.discordClientId,
    response_type: 'code',
    redirect_uri: config.discordRedirectUri,
    scope: 'identify',
    state,
    prompt: 'consent'
  })

  return `${DISCORD_AUTHORIZE}?${params.toString()}`
}

export async function exchangeCode(code) {
  const config = requireEnv([
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI'
  ])

  const body = new URLSearchParams({
    client_id: config.discordClientId,
    client_secret: config.discordClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.discordRedirectUri
  })

  let response
  try {
    response = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body,
      cache: 'no-store'
    })
  } catch {
    throw new AppError("Discord est injoignable. Reessayez.", {
      status: 502,
      code: 'DISCORD_UNAVAILABLE'
    })
  }

  if (!response.ok) {
    console.error('[discord] echange de code refuse', { status: response.status })
    throw new AppError('Connexion Discord refusee.', {
      status: 401,
      code: 'DISCORD_OAUTH_FAILED'
    })
  }

  const data = await response.json()
  if (!data?.access_token) {
    throw new AppError('Reponse Discord invalide.', {
      status: 502,
      code: 'DISCORD_INVALID_RESPONSE'
    })
  }

  return data
}

export async function fetchDiscordUser(accessToken) {
  let response
  try {
    response = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    })
  } catch {
    throw new AppError("Discord est injoignable. Reessayez.", {
      status: 502,
      code: 'DISCORD_UNAVAILABLE'
    })
  }

  if (!response.ok) {
    throw new AppError('Impossible de recuperer le profil Discord.', {
      status: 502,
      code: 'DISCORD_PROFILE_FAILED'
    })
  }

  const profile = await response.json()
  if (!profile?.id) {
    throw new AppError('Profil Discord invalide.', {
      status: 502,
      code: 'DISCORD_INVALID_RESPONSE'
    })
  }

  return profile
}

export function mapDiscordUser(profile) {
  const id = String(profile.id)
  const username = profile.global_name || profile.username || `utilisateur-${id.slice(-4)}`

  let avatar = null
  if (profile.avatar) {
    const extension = String(profile.avatar).startsWith('a_') ? 'gif' : 'png'
    avatar = `https://cdn.discordapp.com/avatars/${id}/${profile.avatar}.${extension}?size=128`
  } else {
    try {
      const index = Number(BigInt(id) >> 22n) % 6
      avatar = `https://cdn.discordapp.com/embed/avatars/${index}.png`
    } catch {
      avatar = `https://cdn.discordapp.com/embed/avatars/0.png`
    }
  }

  return {
    id,
    username,
    avatarUrl: avatar
  }
}

export function getDiscordConfig() {
  return getConfig()
}

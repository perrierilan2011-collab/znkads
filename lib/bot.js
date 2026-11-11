/**
 * Authentification des routes reservees au bot Discord.
 * Secret distinct de toutes les autres cles, compare en temps constant.
 */

import crypto from 'node:crypto'
import { ConfigError, requireEnv } from './config'
import { AppError } from './errors'

export function requireBotAuth(request) {
  const config = requireEnv(['BOT_API_SECRET'])

  if (config.botApiSecret.length < 32) {
    throw new ConfigError({
      missing: [],
      errors: ['BOT_API_SECRET doit contenir au moins 32 caracteres.']
    })
  }

  const authorization = request.headers.get('authorization') || ''
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : request.headers.get('x-bot-api-secret') || ''

  const provided = Buffer.from(token)
  const expected = Buffer.from(config.botApiSecret)

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new AppError('Non autorise.', {
      status: 401,
      code: 'BOT_UNAUTHORIZED'
    })
  }
}

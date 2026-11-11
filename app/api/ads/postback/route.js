/**
 * Postback de la regie publicitaire.
 *
 * Contrat de signature (HMAC SHA-256, hex) :
 *   message   = `${timestamp}.${provider}.${reference}.${discord_id}`
 *   signature = HMAC_SHA256(AD_PROVIDER_SECRET, message)
 *
 * Parametres acceptes en GET (query) ou POST (JSON / form-urlencoded) :
 *   provider, reference, discord_id, timestamp (secondes Unix), signature
 *
 * La reference doit avoir ete creee par POST /api/ads/start.
 * Le montant n'est JAMAIS lu depuis la requete : il vient de AD_REWARD_AMOUNT.
 */

import crypto from 'node:crypto'
import { getConfig } from '@/lib/config'
import { AppError } from '@/lib/errors'
import { handleApiError, jsonError, jsonOk } from '@/lib/http'
import { enforceRateLimit } from '@/lib/rate-limit'
import { creditAdReward, findUserByDiscordId } from '@/lib/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CLOCK_SKEW_SECONDS = 300

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

async function readPayload(request) {
  if (request.method === 'GET') {
    return Object.fromEntries(request.nextUrl.searchParams.entries())
  }

  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      return await request.json()
    } catch {
      return {}
    }
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    try {
      const form = await request.formData()
      return Object.fromEntries(form.entries())
    } catch {
      return {}
    }
  }

  return Object.fromEntries(request.nextUrl.searchParams.entries())
}

async function handlePostback(request) {
  const config = getConfig()

  if (!config.adRewardsEnabled) {
    return jsonError(
      'Les recompenses publicitaires sont desactivees.',
      503,
      'AD_REWARDS_DISABLED'
    )
  }

  enforceRateLimit(request, 'ads-postback', 120, 60_000)

  const payload = await readPayload(request)
  const provider = String(payload.provider || '').trim()
  const reference = String(payload.reference || '').trim()
  const discordId = String(payload.discord_id || '').trim()
  const timestampRaw = String(payload.timestamp || '').trim()
  const signature = String(payload.signature || '').trim().toLowerCase()

  if (!provider || !reference || !discordId || !timestampRaw || !signature) {
    return jsonError('Parametres de postback incomplets.', 400, 'INVALID_POSTBACK')
  }

  if (provider !== config.adProvider) {
    return jsonError('Regie inconnue.', 401, 'INVALID_PROVIDER')
  }

  if (!/^\d{1,32}$/.test(discordId)) {
    return jsonError('Identifiant Discord invalide.', 400, 'INVALID_DISCORD_ID')
  }

  const timestamp = Number(timestampRaw)
  if (!Number.isInteger(timestamp)) {
    return jsonError('Horodatage invalide.', 400, 'INVALID_TIMESTAMP')
  }

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return jsonError('Postback expire.', 401, 'EXPIRED_POSTBACK')
  }

  if (!config.adProviderSecret) {
    return jsonError('Configuration publicitaire incomplete.', 500, 'CONFIG_ERROR')
  }

  const message = `${timestampRaw}.${provider}.${reference}.${discordId}`
  const expected = crypto
    .createHmac('sha256', config.adProviderSecret)
    .update(message)
    .digest('hex')

  if (!safeEqual(signature, expected)) {
    console.warn('[ads] signature de postback invalide', { provider })
    return jsonError('Signature invalide.', 401, 'INVALID_SIGNATURE')
  }

  const user = await findUserByDiscordId(discordId)
  if (!user) {
    return jsonError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND')
  }

  const result = await creditAdReward({
    userId: user.id,
    provider,
    providerReference: reference
  })

  if (result?.status === 'daily_limit_reached') {
    return jsonOk({
      status: 'daily_limit_reached',
      message: 'Limite quotidienne atteinte, publicite non creditee.'
    })
  }

  if (result?.status === 'already_processed') {
    return jsonOk({
      status: 'already_processed',
      message: 'Publicite deja creditee.'
    })
  }

  if (result?.status !== 'credited') {
    throw new AppError('Postback non traite.', {
      status: 409,
      code: 'POSTBACK_NOT_PROCESSED'
    })
  }

  return jsonOk({
    status: 'credited',
    validated_ads: result.validated_ads,
    referral_ad_reward_credited: result.referral_ad_reward_credited === true
  })
}

export async function GET(request) {
  try {
    return await handlePostback(request)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request) {
  try {
    return await handlePostback(request)
  } catch (error) {
    return handleApiError(error)
  }
}

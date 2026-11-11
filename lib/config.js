/**
 * lib/config.js
 * Centralisation et validation de TOUTES les variables d'environnement.
 *
 * Regles :
 * - Ce fichier est reserve au serveur. Ne jamais l'importer dans un composant client.
 * - Aucun secret n'est expose au navigateur.
 * - Aucune valeur metier (montant, limite, URL) n'est codee en dur dans les pages.
 * - Les valeurs sont lues a l'execution. Sur Vercel, un nouveau deploiement est
 *   necessaire apres modification des variables.
 */

import { parseAmountToCents } from './money'

const DEFAULT_SITE_URL = 'http://localhost:3000'

const BASE_REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'SESSION_SECRET'
]

const ADS_REQUIRED = [
  'AD_PROVIDER',
  'AD_PROVIDER_SECRET',
  'AD_PROVIDER_URL'
]

function read(name) {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

function readBoolean(name, fallback = false) {
  const value = read(name).toLowerCase()
  if (value === '') return fallback
  return value === 'true' || value === '1' || value === 'yes'
}

function readInteger(name, fallback) {
  const raw = read(name)
  if (raw === '') return fallback
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

function buildConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const siteUrl = (read('NEXT_PUBLIC_SITE_URL') || DEFAULT_SITE_URL).replace(/\/+$/, '')
  const redirectUri = read('DISCORD_REDIRECT_URI') || `${siteUrl}/api/auth/callback`

  const adRewardRaw = read('AD_REWARD_AMOUNT') || '0.02'
  const referralSignupRaw = read('REFERRAL_SIGNUP_REWARD') || '0.20'
  const referralAdRaw = read('REFERRAL_AD_REWARD') || '0.80'
  const minimumWithdrawalRaw = read('MINIMUM_WITHDRAWAL') || '5.00'

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    siteUrl,

    supabaseUrl: read('SUPABASE_URL'),
    supabaseServiceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY'),

    discordClientId: read('DISCORD_CLIENT_ID'),
    discordClientSecret: read('DISCORD_CLIENT_SECRET'),
    discordRedirectUri: redirectUri,
    discordBotToken: read('DISCORD_BOT_TOKEN'),
    discordWithdrawalInviteUrl: read('DISCORD_WITHDRAWAL_INVITE_URL'),

    botApiSecret: read('BOT_API_SECRET'),
    sessionSecret: read('SESSION_SECRET'),

    dailyAdLimit: readInteger('DAILY_AD_LIMIT', 10),
    adRewardRaw,
    adRewardCents: parseAmountToCents(adRewardRaw),
    adRewardsEnabled: readBoolean('AD_REWARDS_ENABLED', false),
    adProvider: read('AD_PROVIDER'),
    adProviderSecret: read('AD_PROVIDER_SECRET'),
    adProviderUrl: read('AD_PROVIDER_URL'),

    referralSignupRewardRaw: referralSignupRaw,
    referralSignupRewardCents: parseAmountToCents(referralSignupRaw),
    referralAdRewardRaw: referralAdRaw,
    referralAdRewardCents: parseAmountToCents(referralAdRaw),
    referralRequiredAds: readInteger('REFERRAL_REQUIRED_ADS', 10),

    minimumWithdrawalRaw,
    minimumWithdrawalCents: parseAmountToCents(minimumWithdrawalRaw),
    withdrawalsEnabled: readBoolean('WITHDRAWALS_ENABLED', true),

    casinoEnabled: readBoolean('CASINO_ENABLED', true),
    casinoMinBetRaw: read('CASINO_MIN_BET') || '0.10',
    casinoMinBetCents: parseAmountToCents(read('CASINO_MIN_BET') || '0.10'),
    casinoMaxBetRaw: read('CASINO_MAX_BET') || '10.00',
    casinoMaxBetCents: parseAmountToCents(read('CASINO_MAX_BET') || '10.00'),

    currency: (read('CURRENCY') || 'EUR').toUpperCase(),

    sessionCookieSecure: siteUrl.startsWith('https://'),
    sessionMaxAgeSeconds: 60 * 60 * 24 * 7
  })
}

let cachedConfig = null

/**
 * Retourne la configuration (mise en cache pour la duree du processus).
 * Ne jette pas : utiliser validateConfig()/requireConfig() pour les controles.
 */
export function getConfig() {
  if (!cachedConfig) cachedConfig = buildConfig()
  return cachedConfig
}

/**
 * Valide la configuration.
 * @param {{ requireBot?: boolean, requireAds?: boolean, requireWithdrawals?: boolean }} options
 */
export function validateConfig(options = {}) {
  const config = getConfig()
  const missing = []
  const errors = []

  for (const name of BASE_REQUIRED) {
    if (!read(name)) missing.push(name)
  }

  if (config.sessionSecret && config.sessionSecret.length < 32) {
    errors.push('SESSION_SECRET doit contenir au moins 32 caracteres.')
  }

  if (config.currency && !/^[A-Z]{3}$/.test(config.currency)) {
    errors.push('CURRENCY doit etre un code ISO 4217 a 3 lettres (ex: EUR).')
  }

  if (!Number.isInteger(config.dailyAdLimit) || config.dailyAdLimit < 1) {
    errors.push('DAILY_AD_LIMIT doit etre un entier superieur ou egal a 1.')
  }

  if (config.adRewardCents === null || config.adRewardCents <= 0) {
    errors.push('AD_REWARD_AMOUNT doit etre un montant positif (ex: 0.02).')
  }

  if (config.referralSignupRewardCents === null) {
    errors.push('REFERRAL_SIGNUP_REWARD doit etre un montant valide (ex: 0.20).')
  }

  if (config.referralAdRewardCents === null) {
    errors.push('REFERRAL_AD_REWARD doit etre un montant valide (ex: 0.80).')
  }

  if (!Number.isInteger(config.referralRequiredAds) || config.referralRequiredAds < 1) {
    errors.push('REFERRAL_REQUIRED_ADS doit etre un entier superieur ou egal a 1.')
  }

  if (config.minimumWithdrawalCents === null || config.minimumWithdrawalCents <= 0) {
    errors.push('MINIMUM_WITHDRAWAL doit etre un montant positif (ex: 5.00).')
  }

  if (config.withdrawalsEnabled && !config.discordWithdrawalInviteUrl) {
    missing.push('DISCORD_WITHDRAWAL_INVITE_URL')
  }

  if (config.casinoMinBetCents === null || config.casinoMinBetCents <= 0) {
    errors.push('CASINO_MIN_BET doit etre un montant positif (ex: 0.10).')
  }

  if (
    config.casinoMaxBetCents === null ||
    (config.casinoMinBetCents !== null &&
      config.casinoMaxBetCents < config.casinoMinBetCents)
  ) {
    errors.push('CASINO_MAX_BET doit etre un montant superieur ou egal a CASINO_MIN_BET.')
  }

  if (config.adRewardsEnabled || options.requireAds) {
    for (const name of ADS_REQUIRED) {
      if (!read(name)) missing.push(name)
    }
    if (!config.adRewardsEnabled && options.requireAds) {
      errors.push('AD_REWARDS_ENABLED doit etre true pour activer les publicites remunerees.')
    }
  }

  if (options.requireBot) {
    if (!config.botApiSecret) {
      missing.push('BOT_API_SECRET')
    } else if (config.botApiSecret.length < 32) {
      errors.push('BOT_API_SECRET doit contenir au moins 32 caracteres.')
    }
  }

  const uniqueMissing = [...new Set(missing)]

  return {
    valid: uniqueMissing.length === 0 && errors.length === 0,
    missing: uniqueMissing,
    errors
  }
}

/**
 * Exige uniquement une liste de variables (utile pour isoler un sous-systeme).
 */
export function requireEnv(names) {
  const missing = names.filter((name) => !read(name))
  if (missing.length) {
    throw new ConfigError({ missing, errors: [] })
  }
  return getConfig()
}

export class ConfigError extends Error {
  constructor(validation) {
    const parts = []
    if (validation.missing.length) {
      parts.push(`Variables manquantes : ${validation.missing.join(', ')}`)
    }
    if (validation.errors.length) {
      parts.push(...validation.errors)
    }
    super(`Configuration invalide. ${parts.join(' ')}`)
    this.name = 'ConfigError'
    this.code = 'CONFIG_ERROR'
    this.missing = validation.missing
    this.details = validation.errors
  }
}

/**
 * Jette une ConfigError explicite si la configuration est incomplete.
 */
export function requireConfig(options = {}) {
  const validation = validateConfig(options)
  if (!validation.valid) throw new ConfigError(validation)
  return getConfig()
}

/**
 * Sous-ensemble sur : peut etre transmis a des composants client.
 * Aucun secret, aucune cle Supabase, aucun token.
 */
export function getPublicConfig() {
  const config = getConfig()
  return {
    siteUrl: config.siteUrl,
    currency: config.currency,
    dailyAdLimit: config.dailyAdLimit,
    adRewardCents: config.adRewardCents,
    adRewardsEnabled: config.adRewardsEnabled,
    referralSignupRewardCents: config.referralSignupRewardCents,
    referralAdRewardCents: config.referralAdRewardCents,
    referralRequiredAds: config.referralRequiredAds,
    minimumWithdrawalCents: config.minimumWithdrawalCents,
    withdrawalsEnabled: config.withdrawalsEnabled,
    discordWithdrawalInviteUrl: config.discordWithdrawalInviteUrl,
    casinoEnabled: config.casinoEnabled,
    casinoMinBetCents: config.casinoMinBetCents,
    casinoMaxBetCents: config.casinoMaxBetCents
  }
}

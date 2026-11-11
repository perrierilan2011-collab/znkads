/**
 * lib/wallet.js
 * Toutes les operations financieres passent par des fonctions PostgreSQL
 * atomiques (security definer). Le frontend ne peut jamais modifier un solde.
 */

import crypto from 'node:crypto'
import { getConfig, requireEnv } from './config'
import { getSupabaseAdmin } from './supabase'
import { AppError } from './errors'
import { isValidCents } from './money'

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,16}$/

const WITHDRAWAL_STATUSES = ['pending', 'processing', 'accepted', 'rejected', 'paid']

const RPC_ERRORS = {
  insufficient_balance: {
    message: 'Solde insuffisant.',
    status: 400,
    code: 'INSUFFICIENT_BALANCE'
  },
  user_not_found: {
    message: 'Utilisateur introuvable.',
    status: 404,
    code: 'USER_NOT_FOUND'
  },
  invalid_amount: {
    message: 'Montant invalide.',
    status: 400,
    code: 'INVALID_AMOUNT'
  },
  self_referral: {
    message: 'Le parrainage de soi-meme est interdit.',
    status: 400,
    code: 'SELF_REFERRAL'
  },
  referral_already_exists: {
    message: 'Ce compte possede deja un parrain.',
    status: 409,
    code: 'REFERRAL_ALREADY_EXISTS'
  },
  session_not_found: {
    message: 'Session publicitaire introuvable.',
    status: 404,
    code: 'AD_SESSION_NOT_FOUND'
  },
  session_user_mismatch: {
    message: 'Session publicitaire invalide.',
    status: 403,
    code: 'AD_SESSION_MISMATCH'
  },
  invalid_session_status: {
    message: 'Session publicitaire deja traitee.',
    status: 409,
    code: 'AD_SESSION_INVALID_STATUS'
  },
  daily_limit_reached: {
    message: 'Limite quotidienne de publicites atteinte.',
    status: 429,
    code: 'DAILY_LIMIT_REACHED'
  },
  withdrawal_not_found: {
    message: 'Demande de retrait introuvable.',
    status: 404,
    code: 'WITHDRAWAL_NOT_FOUND'
  },
  invalid_transition: {
    message: 'Transition de statut interdite.',
    status: 409,
    code: 'INVALID_WITHDRAWAL_TRANSITION'
  },
  invalid_status: {
    message: 'Statut de retrait invalide.',
    status: 400,
    code: 'INVALID_WITHDRAWAL_STATUS'
  }
}

function throwRpcError(error) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  const match = Object.entries(RPC_ERRORS).find(([key]) => text.includes(key))
  if (match) {
    const [, definition] = match
    throw new AppError(definition.message, definition)
  }

  console.error('[wallet] erreur RPC inattendue', {
    code: error?.code,
    message: error?.message
  })
  throw new AppError('Operation financiere impossible.', {
    status: 500,
    code: 'WALLET_ERROR'
  })
}

export function generateReferralCode(length = 8) {
  let code = ''
  for (let index = 0; index < length; index += 1) {
    code += REFERRAL_ALPHABET[crypto.randomInt(0, REFERRAL_ALPHABET.length)]
  }
  return code
}

export function isValidReferralCode(code) {
  return typeof code === 'string' && REFERRAL_CODE_PATTERN.test(code)
}

/**
 * Cree ou met a jour le compte lie au Discord.
 * Retourne { user, isNew }.
 */
export async function upsertDiscordUser(profile) {
  const supabase = getSupabaseAdmin()

  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('discord_id', profile.id)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing) {
    const { data, error } = await supabase
      .from('users')
      .update({
        discord_username: profile.username,
        discord_avatar: profile.avatarUrl
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return { user: data, isNew: false }
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const referralCode = generateReferralCode()

    const { data, error } = await supabase
      .from('users')
      .insert({
        discord_id: profile.id,
        discord_username: profile.username,
        discord_avatar: profile.avatarUrl,
        referral_code: referralCode
      })
      .select('*')
      .single()

    if (!error) return { user: data, isNew: true }

    if (error.code === '23505' && /discord_id/i.test(error.message)) {
      const { data: raced } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', profile.id)
        .maybeSingle()
      if (raced) return { user: raced, isNew: false }
    }

    if (error.code === '23505') continue

    throw error
  }

  throw new AppError('Impossible de creer le compte (code de parrainage).', {
    status: 500,
    code: 'REFERRAL_CODE_GENERATION_FAILED'
  })
}

/**
 * Enregistre le parrain d'un nouveau compte et credite le bonus d'inscription.
 * Le RPC refuse l'auto-parrainage et les doublons.
 */
export async function applyReferral({ userId, referralCode }) {
  if (!isValidReferralCode(referralCode)) return { status: 'invalid_code' }

  const config = getConfig()
  const supabase = getSupabaseAdmin()

  const { data: referrer, error } = await supabase
    .from('users')
    .select('id')
    .eq('referral_code', referralCode)
    .maybeSingle()

  if (error) throw error
  if (!referrer) return { status: 'unknown_code' }
  if (referrer.id === userId) return { status: 'self_referral' }

  const { data, error: rpcError } = await supabase.rpc('register_referral', {
    p_referrer_id: referrer.id,
    p_referred_id: userId,
    p_referral_code: referralCode,
    p_signup_reward_cents: config.referralSignupRewardCents ?? 0
  })

  if (rpcError) throwRpcError(rpcError)

  console.info('[referral] traite', {
    status: data?.status,
    referrerId: referrer.id,
    referredId: userId
  })

  return data
}

export async function findUserByDiscordId(discordId) {
  if (!/^\d{5,32}$/.test(String(discordId || ''))) {
    throw new AppError('Identifiant Discord invalide.', {
      status: 400,
      code: 'INVALID_DISCORD_ID'
    })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('discord_id', String(discordId))
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getUserById(userId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getTransactions(userId, limit = 25) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, amount_cents, description, reference_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) throw error
  return data || []
}

export async function getWithdrawals(userId, limit = 25) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id, amount_cents, status, discord_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) throw error
  return data || []
}

export async function getReferrals(userId, limit = 25) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('referrals')
    .select(
      'id, status, referral_code, signup_reward_paid, ad_reward_paid, created_at, referred:users!referrals_referred_id_fkey(discord_username, discord_avatar)'
    )
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) throw error
  return data || []
}

export async function getAdSessions(userId, limit = 15) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ad_sessions')
    .select('id, provider, provider_reference, status, reward_cents, validated_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) throw error
  return data || []
}

function startOfUtcDay() {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  return date.toISOString()
}

export async function getWalletSummary(userId, options = {}) {
  const supabase = getSupabaseAdmin()
  const transactionLimit = options.transactionLimit ?? 10
  const referralLimit = options.referralLimit ?? 5
  const withdrawalLimit = options.withdrawalLimit ?? 5

  const [ads, adsToday, referralsCount, transactions, referrals, withdrawals] = await Promise.all([
    supabase
      .from('ad_sessions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'validated')
      .limit(1),
    supabase
      .from('ad_sessions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'validated')
      .gte('validated_at', startOfUtcDay())
      .limit(1),
    supabase
      .from('referrals')
      .select('id', { count: 'exact' })
      .eq('referrer_id', userId)
      .limit(1),
    getTransactions(userId, transactionLimit),
    getReferrals(userId, referralLimit),
    getWithdrawals(userId, withdrawalLimit)
  ])

  const firstError = ads.error || adsToday.error || referralsCount.error
  if (firstError) throw firstError

  return {
    validatedAds: ads.count || 0,
    validatedAdsToday: adsToday.count || 0,
    referralsCount: referralsCount.count || 0,
    transactions,
    referrals,
    withdrawals
  }
}

/**
 * Demarre une session publicitaire. La reference est generee cote serveur.
 * Accepte l'utilisateur complet afin de transmettre son discord_id a la regie.
 */
export async function startAdSession(user) {
  const userId = user.id
  const config = getConfig()

  if (!config.adRewardsEnabled) {
    throw new AppError('Les recompenses publicitaires sont desactivees.', {
      status: 403,
      code: 'AD_REWARDS_DISABLED'
    })
  }

  requireEnv(['AD_PROVIDER', 'AD_PROVIDER_SECRET', 'AD_PROVIDER_URL'])

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('start_ad_session', {
    p_user_id: userId,
    p_provider: config.adProvider,
    p_reward_cents: config.adRewardCents,
    p_daily_limit: config.dailyAdLimit
  })

  if (error) throwRpcError(error)

  if (data?.status === 'daily_limit_reached') {
    throw new AppError('Limite quotidienne de publicites atteinte.', {
      status: 429,
      code: 'DAILY_LIMIT_REACHED'
    })
  }

  if (data?.status !== 'started' || !data?.reference) {
    throw new AppError('Impossible de demarrer la publicite.', {
      status: 500,
      code: 'AD_START_FAILED'
    })
  }

  const encodedReference = encodeURIComponent(data.reference)
  const encodedDiscordId = encodeURIComponent(user.discord_id)
  const hasReferencePlaceholder = config.adProviderUrl.includes('{reference}')
  const hasDiscordPlaceholder = config.adProviderUrl.includes('{discord_id}')

  let redirectUrl = config.adProviderUrl
    .replaceAll('{reference}', encodedReference)
    .replaceAll('{discord_id}', encodedDiscordId)

  const extraParams = []
  if (!hasReferencePlaceholder) {
    extraParams.push(`znk_ref=${encodedReference}`)
  }
  if (!hasDiscordPlaceholder) {
    extraParams.push(`discord_id=${encodedDiscordId}`)
  }

  if (extraParams.length) {
    redirectUrl += `${redirectUrl.includes('?') ? '&' : '?'}${extraParams.join('&')}`
  }

  console.info('[ads] session demarree', {
    userId,
    provider: config.adProvider,
    reference: data.reference
  })

  return {
    ...data,
    redirectUrl
  }
}

/**
 * Credite une publicite apres validation authentifiee de la regie.
 * Idempotent : une session deja validee ne peut jamais etre creditee deux fois.
 */
export async function creditAdReward({ userId, provider, providerReference }) {
  const config = getConfig()

  if (!config.adRewardsEnabled) {
    throw new AppError('Les recompenses publicitaires sont desactivees.', {
      status: 403,
      code: 'AD_REWARDS_DISABLED'
    })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('credit_ad_reward', {
    p_user_id: userId,
    p_provider: provider,
    p_provider_reference: providerReference,
    p_reward_cents: config.adRewardCents,
    p_daily_limit: config.dailyAdLimit,
    p_referral_required_ads: config.referralRequiredAds,
    p_referral_ad_reward_cents: config.referralAdRewardCents ?? 0
  })

  if (error) throwRpcError(error)

  console.info('[ads] postback traite', {
    status: data?.status,
    userId,
    provider,
    providerReference
  })

  return data
}

/**
 * Cree une demande de retrait. Le montant est immediatement reserve
 * (debite du solde disponible) par la fonction atomique.
 */
export async function requestWithdrawal(user, amountCents) {
  const config = getConfig()

  if (!config.withdrawalsEnabled) {
    throw new AppError('Les retraits sont temporairement desactives.', {
      status: 403,
      code: 'WITHDRAWALS_DISABLED'
    })
  }

  if (!isValidCents(amountCents)) {
    throw new AppError('Montant invalide.', {
      status: 400,
      code: 'INVALID_AMOUNT'
    })
  }

  if (amountCents < config.minimumWithdrawalCents) {
    throw new AppError('Le montant est inferieur au minimum de retrait.', {
      status: 400,
      code: 'BELOW_MINIMUM_WITHDRAWAL'
    })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_user_id: user.id,
    p_amount_cents: amountCents,
    p_discord_id: user.discord_id
  })

  if (error) throwRpcError(error)

  console.info('[withdrawal] demande creee', {
    withdrawalId: data?.withdrawal_id,
    userId: user.id,
    amountCents
  })

  return data
}

export function isValidWithdrawalStatus(status) {
  return WITHDRAWAL_STATUSES.includes(status)
}

/**
 * Mise a jour du statut par le bot / l'administration.
 * Un refus rembourse automatiquement le solde reserve.
 */
export async function updateWithdrawalStatus(withdrawalId, status) {
  if (!isValidWithdrawalStatus(status)) {
    throw new AppError('Statut de retrait invalide.', {
      status: 400,
      code: 'INVALID_WITHDRAWAL_STATUS'
    })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('update_withdrawal_status', {
    p_withdrawal_id: withdrawalId,
    p_status: status
  })

  if (error) throwRpcError(error)

  console.info('[withdrawal] statut mis a jour', {
    withdrawalId,
    status,
    refunded: data?.refunded === true
  })

  return data
}

export async function listWithdrawalsForBot(status = null, limit = 50) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('withdrawals')
    .select(
      'id, user_id, amount_cents, status, discord_id, created_at, updated_at, user:users!withdrawals_user_id_fkey(discord_username)'
    )
    .order('created_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getBotUserProfile(discordId) {
  const user = await findUserByDiscordId(discordId)
  if (!user) {
    throw new AppError('Utilisateur introuvable.', {
      status: 404,
      code: 'USER_NOT_FOUND'
    })
  }

  const summary = await getWalletSummary(user.id, {
    transactionLimit: 20,
    referralLimit: 20,
    withdrawalLimit: 20
  })

  return {
    currency: getConfig().currency,
    user: {
      id: user.id,
      discord_id: user.discord_id,
      discord_username: user.discord_username,
      discord_avatar: user.discord_avatar,
      balance_cents: user.balance_cents,
      total_earned_cents: user.total_earned_cents,
      referral_code: user.referral_code,
      created_at: user.created_at
    },
    wallet: {
      validated_ads: summary.validatedAds,
      validated_ads_today: summary.validatedAdsToday,
      referrals_count: summary.referralsCount
    },
    transactions: summary.transactions,
    referrals: summary.referrals,
    withdrawals: summary.withdrawals
  }
}

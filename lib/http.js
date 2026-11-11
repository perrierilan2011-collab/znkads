/**
 * Helpers HTTP serveur : reponses JSON, gestion d'erreurs, protection CSRF,
 * extraction d'IP et limitation de requetes.
 */

import { NextResponse } from 'next/server'
import { ConfigError, getConfig } from './config'
import { AppError } from './errors'

export function jsonOk(data, init = {}) {
  return NextResponse.json({ ok: true, ...data }, init)
}

export function jsonError(message, status = 400, code = 'BAD_REQUEST', details = null) {
  return NextResponse.json(
    { ok: false, error: code, message, ...(details ? { details } : {}) },
    { status }
  )
}

/**
 * Convertit une erreur inconnue en reponse JSON sans fuiter de secret.
 */
export function handleApiError(error) {
  if (error instanceof ConfigError) {
    console.error('[config] configuration invalide', {
      missing: error.missing,
      details: error.details
    })
    return jsonError(error.message, 500, 'CONFIG_ERROR', {
      missing: error.missing,
      errors: error.details
    })
  }

  if (error instanceof AppError) {
    return jsonError(error.message, error.status, error.code, error.details)
  }

  console.error('[api] erreur inattendue', {
    message: error?.message,
    code: error?.code
  })
  return jsonError('Une erreur interne est survenue.', 500, 'INTERNAL_ERROR')
}

/**
 * Protection CSRF pour toutes les mutations.
 * - Header personnalise impossible a envoyer depuis un formulaire cross-site.
 * - Verification de l'origine si elle est presente.
 */
export function assertMutationRequest(request) {
  if (request.headers.get('x-znk-csrf') !== '1') {
    throw new AppError('Requete refusee (CSRF).', { status: 403, code: 'CSRF_REJECTED' })
  }

  const origin = request.headers.get('origin')
  if (!origin) return

  const config = getConfig()
  const allowedOrigins = new Set([request.nextUrl.origin])
  try {
    allowedOrigins.add(new URL(config.siteUrl).origin)
  } catch {
    // NEXT_PUBLIC_SITE_URL invalide : on garde l'origine de la requete.
  }

  if (!allowedOrigins.has(origin)) {
    throw new AppError('Origine non autorisee.', { status: 403, code: 'ORIGIN_REJECTED' })
  }
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

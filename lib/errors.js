/**
 * Erreurs applicatives normalisees.
 */

export class AppError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'AppError'
    this.status = options.status || 400
    this.code = options.code || 'BAD_REQUEST'
    this.details = options.details || null
  }
}

export function isAppError(error) {
  return error instanceof AppError
}

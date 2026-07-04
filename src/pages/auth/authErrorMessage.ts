import { ApiError } from '../../lib/api'

/**
 * Maps an unknown thrown value from a login/register attempt to a
 * user-facing Spanish message. Known backend `code`s get specific copy;
 * validation errors (422 / null code) get a generic "check your data"
 * message; anything else falls back to a generic error.
 */
export function authErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_credentials':
        return 'Email o contraseña incorrectos'
      case 'email_taken':
        return 'Ese email ya está registrado'
      case 'inactive_user':
        return 'La cuenta está inactiva'
      default:
        // null code (e.g. 422 validation) or any unmapped string.
        if (err.code === null || err.status === 422) {
          return 'Revisá los datos ingresados'
        }
        return 'Ocurrió un error, intentá de nuevo'
    }
  }
  return 'Ocurrió un error, intentá de nuevo'
}

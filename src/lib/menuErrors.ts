// Kept apart from menus.ts so tests that automock the API module still get
// the real error mapping.
const MENU_ERROR_MESSAGES: Record<string, string> = {
  menu_name_taken: 'Ya existe un menú con ese nombre.',
  cannot_delete_last_menu: 'No se puede borrar el único menú del restaurante.',
  incomplete_schedule: 'Completá la hora de inicio y la de fin, o dejá ambas vacías.',
  invalid_schedule: 'La hora de inicio y la de fin no pueden ser iguales.',
  cannot_unset_default:
    'Siempre tiene que haber un menú principal. Marcá otro menú como principal para cambiarlo.',
}

/** Maps a backend error code to a Spanish message; falls back to `fallback`. */
export function menuErrorMessage(err: unknown, fallback: string): string {
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code === 'string' && code in MENU_ERROR_MESSAGES) return MENU_ERROR_MESSAGES[code]
  return fallback
}

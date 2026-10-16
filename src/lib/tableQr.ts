import type { Table } from './types'

/** Public menu URL for a specific table: `<origin>/menu/<token>?mesa=<n>`. */
export function tableMenuUrl(origin: string, qrToken: string, tableNumber: number): string {
  const base = origin.replace(/\/+$/, '')
  return `${base}/menu/${qrToken}?mesa=${encodeURIComponent(String(tableNumber))}`
}

/** Strict parse of the `mesa` query value: positive integers only, else null. */
export function parseTableParam(raw: string | null): number | null {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

const storageKey = (qrToken: string): string => `menu_table_${qrToken}`

export function readStoredTable(qrToken: string): number | null {
  try {
    return parseTableParam(sessionStorage.getItem(storageKey(qrToken)))
  } catch {
    return null
  }
}

export function storeTable(qrToken: string, tableNumber: number): void {
  try {
    sessionStorage.setItem(storageKey(qrToken), String(tableNumber))
  } catch {
    // Storage unavailable: the URL alone still works.
  }
}

/**
 * Resolves the preselected table: a valid `?mesa=` that matches a published
 * table wins (and is persisted); otherwise the session-stored number if it
 * still matches. Returns null when nothing matches.
 */
export function resolvePreselectedTable(
  qrToken: string,
  rawParam: string | null,
  tables: Table[],
): Table | null {
  const fromUrl = parseTableParam(rawParam)
  const urlMatch = fromUrl === null ? null : (tables.find((t) => t.number === fromUrl) ?? null)
  if (urlMatch !== null) {
    storeTable(qrToken, urlMatch.number)
    return urlMatch
  }
  const stored = readStoredTable(qrToken)
  return stored === null ? null : (tables.find((t) => t.number === stored) ?? null)
}

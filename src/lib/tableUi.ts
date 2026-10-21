import type { TableStatus } from './types'

export const STATUS_META: Record<TableStatus, { label: string; badge: string; dot: string }> = {
  free: {
    label: 'Libre',
    badge:
      'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400',
    dot: 'bg-green-500',
  },
  occupied: {
    label: 'Ocupada',
    badge:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  bill: {
    label: 'Cuenta',
    badge:
      'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
}

/** Moneda local a partir de un Decimal serializado (string). */
export function formatMoney(value: string): string {
  const n = parseFloat(value)
  return `$${(Number.isFinite(n) ? n : 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** "hace 25 min" desde un ISO; `now` en ms para poder testear. */
export function elapsedLabel(iso: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'hace instantes'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`
}

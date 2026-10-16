import React from 'react'
import { useLocation } from 'react-router-dom'
import { CheckCircle2, Clock, Menu, QrCode } from 'lucide-react'
import type { CashShift, Restaurant } from '../../lib/types'

const SECTION_LABELS: Array<[string, string]> = [
  ['/dashboard/menu', 'Mi menú'],
  ['/dashboard/promos', 'Promos'],
  ['/dashboard/appearance', 'Apariencia'],
  ['/dashboard/info', 'Mi restaurante'],
  ['/dashboard/tables', 'Mesas'],
  ['/dashboard/orders', 'Comandas'],
  ['/dashboard/shifts', 'Turnos'],
  ['/dashboard/stock', 'Stock de mercadería'],
  ['/dashboard/suppliers', 'Proveedores'],
  ['/dashboard/staff', 'Usuarios y roles'],
]

export function sectionLabel(pathname: string): string {
  const match = SECTION_LABELS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return match ? match[1] : 'Inicio'
}

function formatShiftStart(shift: CashShift): string | null {
  const date = new Date(shift.opened_at)
  if (Number.isNaN(date.getTime())) return null
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} hs`
}

interface DashboardTopBarProps {
  restaurant: Restaurant | null
  currentShift: CashShift | null
  roleLabel: string | null
  /** Opens the sidebar drawer (< md only). */
  onOpenNav: () => void
}

export default function DashboardTopBar({
  restaurant,
  currentShift,
  roleLabel,
  onOpenNav,
}: DashboardTopBarProps): React.JSX.Element {
  const { pathname } = useLocation()
  const shiftStart = currentShift ? formatShiftStart(currentShift) : null
  const receiving = restaurant?.orders_enabled ?? false

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 md:px-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Abrir menú de navegación"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
        {restaurant && (
          <>
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {restaurant.name}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">
              /
            </span>
          </>
        )}
        <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {sectionLabel(pathname)}
        </span>
      </div>

      <div className="hidden items-center gap-3 text-xs text-neutral-500 md:flex dark:text-neutral-400">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
          <span className="tabular-nums">{shiftStart ? `Turno: ${shiftStart}` : 'Sin turno abierto'}</span>
        </div>
        {restaurant && (
          <>
            <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">·</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${receiving ? 'text-emerald-600 dark:text-emerald-500' : 'text-neutral-400'}`}
                aria-hidden="true"
              />
              <span>{receiving ? 'Recepción activa' : 'Pedidos pausados'}</span>
            </div>
          </>
        )}
        {roleLabel && (
          <>
            <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">·</span>
            <span className="font-medium text-neutral-600 dark:text-neutral-300">{roleLabel}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {restaurant && (
          <a
            href={`/menu/${restaurant.qr_token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            <QrCode className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
            <span>Ver Menú Cliente</span>
          </a>
        )}
      </div>
    </header>
  )
}

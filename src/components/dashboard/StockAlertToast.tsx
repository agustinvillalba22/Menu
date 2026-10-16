import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Package, X } from 'lucide-react'
import type { StockItem } from '../../lib/types'
import { isCriticalStock } from '../../lib/stockStatus'

const STORAGE_KEY = 'menu_stock_alert_dismissed'

/** Dismissal is tied to *which* items are low, so a new shortage re-opens the alert. */
function signatureOf(items: StockItem[]): string {
  return items
    .map((i) => i.id)
    .sort()
    .join(',')
}

function readDismissed(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeDismissed(signature: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, signature)
  } catch {
    // Storage unavailable: the dismissal still holds in memory for this mount.
  }
}

export default function StockAlertToast({ items }: { items: StockItem[] }): React.JSX.Element | null {
  const signature = signatureOf(items)
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)

  if (items.length === 0 || dismissed === signature) return null

  const critical = items.filter(isCriticalStock)
  const primary = critical[0] ?? items[0]

  function dismiss(): void {
    writeDismissed(signature)
    setDismissed(signature)
  }

  return (
    <div
      role="alert"
      className="fixed right-4 bottom-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-amber-200/90 bg-white/95 p-4 text-neutral-900 shadow-2xl shadow-neutral-900/10 backdrop-blur-md md:w-96 dark:border-amber-900/60 dark:bg-neutral-900/95 dark:text-neutral-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 dark:text-neutral-100">
              <span>Alerta de Stock Mínimo</span>
              <span className="rounded border border-amber-200 bg-amber-100 px-1.5 font-mono text-[10px] font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300">
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </span>
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {critical.length > 0
                ? `${critical.length} en nivel crítico de reposición`
                : 'Alcanzaron el umbral mínimo de seguridad'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar notificación"
          title="Cerrar notificación"
          className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
        <p className="text-xs leading-snug text-neutral-600 dark:text-neutral-300">
          {items.length === 1 ? (
            <>
              El insumo <span className="font-semibold text-amber-900 dark:text-amber-300">{primary.name}</span> tiene{' '}
              <span className="font-mono font-medium text-amber-700 dark:text-amber-400">
                {primary.quantity} {primary.unit}
              </span>{' '}
              (mínimo:{' '}
              <span className="font-mono text-neutral-500 dark:text-neutral-400">
                {primary.min_threshold} {primary.unit}
              </span>
              ).
            </>
          ) : (
            <>
              <span className="font-semibold text-amber-900 dark:text-amber-300">{primary.name}</span> y otros{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{items.length - 1} insumos</span>{' '}
              necesitan reposición proactiva.
            </>
          )}
        </p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {items.slice(0, 3).map((item) => (
            <span
              key={item.id}
              className={`flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-medium ${
                isCriticalStock(item)
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              <Package className="h-2.5 w-2.5" aria-hidden="true" />
              <span className="max-w-[120px] truncate">{item.name}</span>: {item.quantity}/{item.min_threshold} {item.unit}
            </span>
          ))}
          {items.length > 3 && (
            <span className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              +{items.length - 3} más
            </span>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          Descartar
        </button>
        <Link
          to="/dashboard/stock"
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          <span>Gestionar Stock</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

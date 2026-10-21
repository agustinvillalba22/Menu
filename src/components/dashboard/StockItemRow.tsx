import React, { useState } from 'react'
import { updateStockItem, deleteStockItem } from '../../lib/stockItems'
import { ApiError } from '../../lib/api'
import type { StockItem, StockUnit, Supplier } from '../../lib/types'
import { isCriticalStock, isLowStock } from '../../lib/stockStatus'
import RowActions from './RowActions'

// M19 RF-06: client-side status badge — no backend endpoint for this.
function statusFor(item: StockItem): { label: string; className: string } {
  if (isCriticalStock(item)) {
    return { label: 'Crítico', className: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-400' }
  }
  if (isLowStock(item)) {
    return { label: 'Bajo', className: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400' }
  }
  return { label: 'Óptimo', className: 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-400' }
}

const UNIT_OPTIONS: StockUnit[] = ['kg', 'g', 'l', 'unidades', 'botellas']

interface StockItemRowProps {
  restaurantId: string
  item: StockItem
  suppliers: Supplier[]
  onUpdated: (item: StockItem) => void
  onDeleted: (stockItemId: string) => void
}

export default function StockItemRow({
  restaurantId,
  item,
  suppliers,
  onUpdated,
  onDeleted,
}: StockItemRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draftQuantity, setDraftQuantity] = useState(item.quantity)
  const [draftMinThreshold, setDraftMinThreshold] = useState(item.min_threshold)
  const [draftUnit, setDraftUnit] = useState<StockUnit>(item.unit)
  const [draftSupplierId, setDraftSupplierId] = useState(item.supplier_id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supplierName = suppliers.find((s) => s.id === item.supplier_id)?.name ?? null
  const status = statusFor(item)

  async function handleSave(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateStockItem(restaurantId, item.id, {
        quantity: draftQuantity,
        min_threshold: draftMinThreshold,
        unit: draftUnit,
        supplier_id: draftSupplierId === '' ? null : draftSupplierId,
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await deleteStockItem(restaurantId, item.id)
      onDeleted(item.id)
    } catch {
      setError('No se pudo eliminar.')
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
      {editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <input
            aria-label="Cantidad"
            type="text"
            inputMode="decimal"
            value={draftQuantity}
            onChange={(e) => setDraftQuantity(e.target.value)}
            className="w-20 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          />
          <select
            aria-label="Unidad"
            value={draftUnit}
            onChange={(e) => setDraftUnit(e.target.value as StockUnit)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <input
            aria-label="Umbral mínimo"
            type="text"
            inputMode="decimal"
            value={draftMinThreshold}
            onChange={(e) => setDraftMinThreshold(e.target.value)}
            className="w-20 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          />
          <select
            aria-label="Proveedor"
            value={draftSupplierId}
            onChange={(e) => setDraftSupplierId(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.quantity} {item.unit}
            {supplierName ? ` · ${supplierName}` : ''}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
        {error && <span className="text-xs text-red-700 dark:text-red-400">{error}</span>}
        <RowActions
          editing={editing}
          busy={busy}
          onStartEdit={() => {
            setDraftQuantity(item.quantity)
            setDraftMinThreshold(item.min_threshold)
            setDraftUnit(item.unit)
            setDraftSupplierId(item.supplier_id ?? '')
            setError(null)
            setEditing(true)
          }}
          onSave={handleSave}
          onCancelEdit={() => setEditing(false)}
          onDelete={handleDelete}
          deleteConfirmMessage="¿Borrar este insumo?"
        />
      </div>
    </li>
  )
}

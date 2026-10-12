import React, { useState } from 'react'
import { updateSupplier, deleteSupplier } from '../../lib/suppliers'
import { ApiError } from '../../lib/api'
import type { Supplier } from '../../lib/types'
import RowActions from './RowActions'

interface SupplierRowProps {
  restaurantId: string
  supplier: Supplier
  onUpdated: (supplier: Supplier) => void
  onDeleted: (supplierId: string) => void
}

export default function SupplierRow({
  restaurantId,
  supplier,
  onUpdated,
  onDeleted,
}: SupplierRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(supplier.name)
  const [draftCategory, setDraftCategory] = useState(supplier.category ?? '')
  const [draftPhone, setDraftPhone] = useState(supplier.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateSupplier(restaurantId, supplier.id, {
        name: draftName,
        category: draftCategory.trim() === '' ? null : draftCategory,
        phone: draftPhone.trim() === '' ? null : draftPhone,
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
      await deleteSupplier(restaurantId, supplier.id)
      onDeleted(supplier.id)
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
            aria-label="Nombre del proveedor"
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="w-36 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          />
          <input
            aria-label="Rubro"
            type="text"
            placeholder="Rubro"
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            className="w-28 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          />
          <input
            aria-label="Teléfono"
            type="text"
            placeholder="Teléfono"
            value={draftPhone}
            onChange={(e) => setDraftPhone(e.target.value)}
            className="w-32 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          />
        </div>
      ) : (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{supplier.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {[supplier.category, supplier.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {error && <span className="text-xs text-red-700 dark:text-red-400">{error}</span>}
        <RowActions
          editing={editing}
          busy={busy}
          onStartEdit={() => {
            setDraftName(supplier.name)
            setDraftCategory(supplier.category ?? '')
            setDraftPhone(supplier.phone ?? '')
            setError(null)
            setEditing(true)
          }}
          onSave={handleSave}
          onCancelEdit={() => setEditing(false)}
          onDelete={handleDelete}
          deleteConfirmMessage="¿Borrar este proveedor? Los insumos ligados quedan sin proveedor."
        />
      </div>
    </li>
  )
}

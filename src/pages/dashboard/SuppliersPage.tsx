import React, { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { createSupplier, listSuppliers } from '../../lib/suppliers'
import { ApiError } from '../../lib/api'
import type { Supplier } from '../../lib/types'
import SupplierRow from '../../components/dashboard/SupplierRow'

export default function SuppliersPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (restaurantId === null) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load(id: string): Promise<void> {
      setLoading(true)
      setLoadError(null)
      try {
        const list = await listSuppliers(id)
        if (!cancelled) setSuppliers(list)
      } catch {
        if (!cancelled) setLoadError('No se pudieron cargar los proveedores.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load(restaurantId)
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  if (restaurantLoading || loading) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  if (restaurantError) {
    return (
      <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {restaurantError}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Creá tu restaurante primero desde “Mi restaurante”.
      </p>
    )
  }

  return (
    <SuppliersSection
      restaurantId={restaurant.id}
      suppliers={suppliers}
      onSuppliersChange={setSuppliers}
      loadError={loadError}
    />
  )
}

interface SuppliersSectionProps {
  restaurantId: string
  suppliers: Supplier[]
  onSuppliersChange: (updater: (prev: Supplier[]) => Supplier[]) => void
  loadError: string | null
}

function SuppliersSection({
  restaurantId,
  suppliers,
  onSuppliersChange,
  loadError,
}: SuppliersSectionProps): React.JSX.Element {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const supplier = await createSupplier(restaurantId, { name: newName.trim() })
      onSuppliersChange((prev) => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear el proveedor.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Proveedores</h1>

        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2" noValidate>
          <div>
            <label htmlFor="new-supplier-name" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Nombre
            </label>
            <input
              id="new-supplier-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-48 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={creating || newName.trim() === ''}
            className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Agregando…' : 'Agregar proveedor'}
          </button>
        </form>
        {createError && (
          <div role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
            {createError}
          </div>
        )}
      </div>

      {loadError && (
        <div role="alert" className="mt-4 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {loadError}
        </div>
      )}

      {suppliers.length === 0 && !loadError && (
        <div className="mt-4 rounded-xl bg-white dark:bg-gray-900 p-6 text-sm text-gray-500 dark:text-gray-400 shadow-sm">
          Todavía no cargaste ningún proveedor.
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {suppliers.map((supplier) => (
          <React.Fragment key={supplier.id}>
            <SupplierRow
              restaurantId={restaurantId}
              supplier={supplier}
              onUpdated={(updated) =>
                onSuppliersChange((prev) =>
                  prev.map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name)),
                )
              }
              onDeleted={(id) => onSuppliersChange((prev) => prev.filter((s) => s.id !== id))}
            />
          </React.Fragment>
        ))}
      </ul>
    </div>
  )
}

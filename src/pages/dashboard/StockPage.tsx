import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { useRestaurantData } from '../../hooks/useRestaurantData'
import { createStockItem, listStockItems } from '../../lib/stockItems'
import { listSuppliers } from '../../lib/suppliers'
import { ApiError } from '../../lib/api'
import type { StockCategory, StockItem, StockUnit, Supplier } from '../../lib/types'
import StockItemRow from '../../components/dashboard/StockItemRow'
import RestaurantGate from '../../components/dashboard/RestaurantGate'

const CATEGORY_OPTIONS: { value: StockCategory; label: string }[] = [
  { value: 'carnes_pescados', label: 'Carnes y pescados' },
  { value: 'verduras_frescos', label: 'Verduras y frescos' },
  { value: 'almacen_secos', label: 'Almacén y secos' },
  { value: 'lacteos', label: 'Lácteos' },
  { value: 'bebidas_licores', label: 'Bebidas y licores' },
]

const UNIT_OPTIONS: StockUnit[] = ['kg', 'g', 'l', 'unidades', 'botellas']

interface StockData {
  items: StockItem[]
  suppliers: Supplier[]
}

const NO_STOCK: StockData = { items: [], suppliers: [] }

async function loadStock(restaurantId: string): Promise<StockData> {
  const [items, suppliers] = await Promise.all([listStockItems(restaurantId), listSuppliers(restaurantId)])
  return { items, suppliers }
}

export default function StockPage(): React.JSX.Element {
  return <RestaurantGate>{(restaurant) => <StockContent restaurantId={restaurant.id} />}</RestaurantGate>
}

function StockContent({ restaurantId }: { restaurantId: string }): React.JSX.Element {
  const { data, setData, loading, error } = useRestaurantData(
    restaurantId,
    loadStock,
    NO_STOCK,
    'No se pudo cargar el stock.',
  )

  if (loading) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  return (
    <div className="space-y-6">
      <StockItemsSection
        restaurantId={restaurantId}
        items={data.items}
        suppliers={data.suppliers}
        onItemsChange={(update) => setData((prev) => ({ ...prev, items: update(prev.items) }))}
        loadError={error}
      />
    </div>
  )
}

interface StockItemsSectionProps {
  restaurantId: string
  items: StockItem[]
  suppliers: Supplier[]
  onItemsChange: (updater: (prev: StockItem[]) => StockItem[]) => void
  loadError: string | null
}

function StockItemsSection({
  restaurantId,
  items,
  suppliers,
  onItemsChange,
  loadError,
}: StockItemsSectionProps): React.JSX.Element {
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<StockCategory>('almacen_secos')
  const [newUnit, setNewUnit] = useState<StockUnit>('kg')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const item = await createStockItem(restaurantId, {
        name: newName.trim(),
        category: newCategory,
        unit: newUnit,
      })
      onItemsChange((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear el insumo.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Insumos</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Inventario cargado a mano — la cantidad no se descuenta sola al vender.
        </p>

        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2" noValidate>
          <div>
            <label htmlFor="new-stock-name" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Nombre
            </label>
            <input
              id="new-stock-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-40 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-stock-category" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Categoría
            </label>
            <select
              id="new-stock-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as StockCategory)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-stock-unit" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Unidad
            </label>
            <select
              id="new-stock-unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as StockUnit)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || newName.trim() === ''}
            className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Agregando…' : 'Agregar insumo'}
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

      {items.length === 0 && !loadError && (
        <div className="mt-4 rounded-xl bg-white dark:bg-gray-900 p-6 text-sm text-gray-500 dark:text-gray-400 shadow-sm">
          Todavía no cargaste ningún insumo.
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <React.Fragment key={item.id}>
            <StockItemRow
              restaurantId={restaurantId}
              item={item}
              suppliers={suppliers}
              onUpdated={(updated) =>
                onItemsChange((prev) =>
                  prev.map((i) => (i.id === updated.id ? updated : i)).sort((a, b) => a.name.localeCompare(b.name)),
                )
              }
              onDeleted={(id) => onItemsChange((prev) => prev.filter((i) => i.id !== id))}
            />
          </React.Fragment>
        ))}
      </ul>
    </div>
  )
}

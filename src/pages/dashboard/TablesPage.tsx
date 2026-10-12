import React, { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { createTable, deleteTable, listTables, updateTable } from '../../lib/tables'
import { listOrders } from '../../lib/orders'
import { ApiError } from '../../lib/api'
import type { Table } from '../../lib/types'
import RowActions from '../../components/dashboard/RowActions'

// M17 — "ocupada" is derived client-side: a table counts as occupied while
// it has at least one order in a non-terminal status. No separate
// "occupancy" endpoint on the backend.
const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'ready'])

export default function TablesPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())

  const [newNumber, setNewNumber] = useState('')
  const [newCapacity, setNewCapacity] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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
        const [tableList, orders] = await Promise.all([listTables(id), listOrders(id)])
        if (cancelled) return
        setTables(tableList)
        setOccupiedIds(
          new Set(
            orders
              .filter((o) => o.table_id !== null && ACTIVE_STATUSES.has(o.status))
              .map((o) => o.table_id as string),
          ),
        )
      } catch {
        if (!cancelled) setLoadError('No se pudieron cargar las mesas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load(restaurantId)
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (restaurantId === null) return
    setCreating(true)
    setCreateError(null)
    try {
      const table = await createTable(restaurantId, {
        number: Number(newNumber),
        capacity: newCapacity === '' ? null : Number(newCapacity),
      })
      setTables((prev) => [...prev, table].sort((a, b) => a.number - b.number))
      setNewNumber('')
      setNewCapacity('')
    } catch (err) {
      setCreateError(
        err instanceof ApiError && err.status === 409
          ? 'Ya existe una mesa con ese número.'
          : 'No se pudo crear la mesa.',
      )
    } finally {
      setCreating(false)
    }
  }

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
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Mesas</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Las mesas que cargues acá aparecen como opción en el checkout del menú público
          cuando un cliente elige "En mesa".
        </p>

        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2" noValidate>
          <div>
            <label htmlFor="new-table-number" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Número
            </label>
            <input
              id="new-table-number"
              type="number"
              min={1}
              required
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              className="w-24 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-table-capacity" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Capacidad (opcional)
            </label>
            <input
              id="new-table-capacity"
              type="number"
              min={1}
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              className="w-24 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={creating || newNumber.trim() === ''}
            className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Agregando…' : 'Agregar mesa'}
          </button>
        </form>
        {createError && (
          <div role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
            {createError}
          </div>
        )}
      </div>

      {loadError && (
        <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {loadError}
        </div>
      )}

      {tables.length === 0 && !loadError && (
        <div className="rounded-xl bg-white dark:bg-gray-900 p-6 text-sm text-gray-500 dark:text-gray-400 shadow-sm">
          Todavía no cargaste ninguna mesa.
        </div>
      )}

      <ul className="space-y-2">
        {tables.map((table) => (
          <React.Fragment key={table.id}>
            <TableRow
              restaurantId={restaurant.id}
              table={table}
              occupied={occupiedIds.has(table.id)}
              onUpdated={(updated) =>
                setTables((prev) =>
                  prev.map((t) => (t.id === updated.id ? updated : t)).sort((a, b) => a.number - b.number),
                )
              }
              onDeleted={(id) => setTables((prev) => prev.filter((t) => t.id !== id))}
            />
          </React.Fragment>
        ))}
      </ul>
    </div>
  )
}

interface TableRowProps {
  restaurantId: string
  table: Table
  occupied: boolean
  onUpdated: (table: Table) => void
  onDeleted: (tableId: string) => void
}

function TableRow({ restaurantId, table, occupied, onUpdated, onDeleted }: TableRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draftNumber, setDraftNumber] = useState(String(table.number))
  const [draftCapacity, setDraftCapacity] = useState(table.capacity === null ? '' : String(table.capacity))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateTable(restaurantId, table.id, {
        number: Number(draftNumber),
        capacity: draftCapacity === '' ? null : Number(draftCapacity),
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'Ya existe una mesa con ese número.'
          : 'No se pudo guardar.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await deleteTable(restaurantId, table.id)
      onDeleted(table.id)
    } catch {
      setError('No se pudo eliminar.')
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
      {editing ? (
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor={`table-number-${table.id}`} className="sr-only">
              Número
            </label>
            <input
              id={`table-number-${table.id}`}
              type="number"
              min={1}
              value={draftNumber}
              onChange={(e) => setDraftNumber(e.target.value)}
              className="w-20 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor={`table-capacity-${table.id}`} className="sr-only">
              Capacidad
            </label>
            <input
              id={`table-capacity-${table.id}`}
              type="number"
              min={1}
              placeholder="Capacidad"
              value={draftCapacity}
              onChange={(e) => setDraftCapacity(e.target.value)}
              className="w-24 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mesa {table.number}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {table.capacity !== null ? `Capacidad: ${table.capacity}` : 'Sin capacidad cargada'}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            occupied
              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400'
              : 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-400'
          }`}
        >
          {occupied ? 'Ocupada' : 'Libre'}
        </span>

        {error && <span className="text-xs text-red-700 dark:text-red-400">{error}</span>}

        <RowActions
          editing={editing}
          busy={busy}
          onStartEdit={() => {
            setDraftNumber(String(table.number))
            setDraftCapacity(table.capacity === null ? '' : String(table.capacity))
            setError(null)
            setEditing(true)
          }}
          onSave={handleSave}
          onCancelEdit={() => setEditing(false)}
          onDelete={handleDelete}
          deleteConfirmMessage="¿Borrar esta mesa?"
        />
      </div>
    </li>
  )
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { createTable, getTablesOccupancy } from '../../lib/tables'
import { listStaffMembers } from '../../lib/staff'
import { ApiError } from '../../lib/api'
import { tableMenuUrl } from '../../lib/tableQr'
import { downloadAllTableQrs } from '../../lib/tableQrSheet'
import { STATUS_META } from '../../lib/tableUi'
import type { StaffMember, Table, TableOccupancy, TableStatus } from '../../lib/types'
import TableCard from '../../components/dashboard/tables/TableCard'
import TableDetailPanel from '../../components/dashboard/tables/TableDetailPanel'

const POLL_MS = 15000
const TICK_MS = 60000
const sortByNumber = (l: TableOccupancy[]): TableOccupancy[] => [...l].sort((a, b) => a.number - b.number)
const INPUT =
  'w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none'
const ALERT = 'rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400'

export default function TablesPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const rid = restaurant?.id ?? null

  const [tables, setTables] = useState<TableOccupancy[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [newNumber, setNewNumber] = useState('')
  const [newCapacity, setNewCapacity] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)

  const seq = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    if (rid === null) return
    const mine = ++seq.current
    try {
      const data = await getTablesOccupancy(rid)
      if (mine !== seq.current) return // a newer refresh/replace superseded this response
      setTables(sortByNumber(data))
      setLoadError(null)
    } catch {
      setLoadError('No se pudieron cargar las mesas.')
    }
  }, [rid])

  useEffect(() => {
    if (rid === null) {
      if (!restaurantLoading) setLoading(false)
      return
    }
    let active = true
    void refresh().finally(() => {
      if (active) setLoading(false)
    })
    listStaffMembers(rid)
      .then((m) => active && setStaff(m.filter((s) => s.active)))
      .catch(() => active && setStaff([]))
    const poll = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, POLL_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => {
      active = false
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(tick)
    }
  }, [rid, refresh, restaurantLoading])

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (rid === null) return
    setCreating(true)
    setCreateError(null)
    try {
      const t = await createTable(rid, {
        number: Number(newNumber),
        capacity: newCapacity === '' ? null : Number(newCapacity),
      })
      setTables((prev) =>
        sortByNumber([
          ...prev,
          { id: t.id, number: t.number, capacity: t.capacity, status: 'free', total: '0.00', first_order_at: null, bill_requested_at: null, orders: [] },
        ]),
      )
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

  async function handleDownloadAll(): Promise<void> {
    if (!restaurant) return
    setQrError(null)
    try {
      await downloadAllTableQrs(
        tables.map((t) => ({ number: t.number, url: tableMenuUrl(window.location.origin, restaurant.qr_token, t.number) })),
      )
    } catch {
      setQrError('No se pudo generar el PNG de QRs.')
    }
  }

  function replace(updated: TableOccupancy): void {
    seq.current++
    setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function edited(t: Table): void {
    setTables((prev) => sortByNumber(prev.map((x) => (x.id === t.id ? { ...x, number: t.number, capacity: t.capacity } : x))))
  }

  if (restaurantLoading || loading) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }
  if (restaurantError) {
    return <div role="alert" className={ALERT}>{restaurantError}</div>
  }
  if (!restaurant) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Creá tu restaurante primero desde “Mi restaurante”.</p>
  }

  const counts: Record<TableStatus, number> = { free: 0, occupied: 0, bill: 0 }
  tables.forEach((t) => (counts[t.status] += 1))
  const selected = tables.find((t) => t.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Plano operativo de mesas</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Control de mesas en tiempo real, comanda y gestión de cuentas. Se actualiza cada {POLL_MS / 1000} segundos.
        </p>
      </div>

      {loadError && <div role="alert" className={ALERT}>{loadError}</div>}
      {qrError && <div role="alert" className={ALERT}>{qrError}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Mesas" className="rounded-xl bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <h2 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Mesas del salón</h2>
            <ul className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400" aria-label="Leyenda">
              {(Object.keys(STATUS_META) as TableStatus[]).map((s) => (
                <li key={s} className="flex items-center gap-1">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
                  {STATUS_META[s].label} ({counts[s]})
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2" noValidate>
              <div>
                <label htmlFor="new-table-number" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Número</label>
                <input id="new-table-number" type="number" min={1} required value={newNumber} onChange={(e) => setNewNumber(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="new-table-capacity" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Capacidad (opcional)</label>
                <input id="new-table-capacity" type="number" min={1} value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} className={INPUT} />
              </div>
              <button
                type="submit"
                disabled={creating || newNumber.trim() === ''}
                className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Agregando…' : 'Agregar mesa'}
              </button>
            </form>
            {tables.length > 0 && (
              <button
                type="button"
                onClick={() => void handleDownloadAll()}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Descargar todos
              </button>
            )}
          </div>
          {createError && <div role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">{createError}</div>}

          {tables.length === 0 && !loadError ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Todavía no cargaste ninguna mesa.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {tables.map((t) => (
                <React.Fragment key={t.id}>
                  <TableCard table={t} selected={t.id === selectedId} now={now} onSelect={setSelectedId} />
                </React.Fragment>
              ))}
            </div>
          )}
        </section>

        <aside aria-label="Detalle de la mesa">
          {selected ? (
            <React.Fragment key={selected.id}>
            <TableDetailPanel
              restaurantId={restaurant.id}
              qrToken={restaurant.qr_token}
              table={selected}
              staff={staff}
              onReplace={replace}
              onEdited={edited}
              onDeleted={(id) => {
                setTables((prev) => prev.filter((t) => t.id !== id))
                setSelectedId(null)
              }}
              onRefresh={() => void refresh()}
            />
            </React.Fragment>
          ) : (
            <div className="rounded-xl bg-white dark:bg-gray-900 p-5 text-sm text-gray-500 dark:text-gray-400 shadow-sm">
              Seleccioná una mesa
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

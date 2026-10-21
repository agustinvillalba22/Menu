import React, { useState } from 'react'
import type { StaffMember, Table, TableOccupancy } from '../../../lib/types'
import { ApiError } from '../../../lib/api'
import { checkoutTable, deleteTable, requestBill, updateTable } from '../../../lib/tables'
import { tableMenuUrl } from '../../../lib/tableQr'
import { formatMoney, STATUS_META } from '../../../lib/tableUi'
import RowActions from '../RowActions'
import QrCodeDisplay from '../QrCodeDisplay'
import TableOrders from './TableOrders'

interface Props {
  restaurantId: string
  qrToken: string
  table: TableOccupancy
  staff: StaffMember[]
  onReplace: (t: TableOccupancy) => void
  onEdited: (t: Table) => void
  onDeleted: (id: string) => void
  onRefresh: () => void
}

const BTN = 'rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60'
const INPUT =
  'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none'

export default function TableDetailPanel(p: Props): React.JSX.Element {
  const { table } = p
  const meta = STATUS_META[table.status]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [staffId, setStaffId] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftNumber, setDraftNumber] = useState(String(table.number))
  const [draftCapacity, setDraftCapacity] = useState(table.capacity === null ? '' : String(table.capacity))

  async function run(fn: () => Promise<void>, fallback: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.detail === 'table_not_occupied') {
        setError('La mesa ya no tiene pedidos activos')
        p.onRefresh()
      } else if (err instanceof ApiError && err.status === 409) {
        setError('Ya existe una mesa con ese número.')
      } else {
        setError(fallback)
      }
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const url = tableMenuUrl(window.location.origin, p.qrToken, table.number)
  const active = table.status !== 'free'

  return (
    <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">Mesa #{table.number}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {table.capacity !== null ? `Capacidad: ${table.capacity} comensales` : 'Sin capacidad cargada'}
          </p>
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-700 dark:text-gray-300">
            Número
            <input type="number" min={1} value={draftNumber} onChange={(e) => setDraftNumber(e.target.value)} className={`${INPUT} mt-1 block w-24`} />
          </label>
          <label className="text-xs text-gray-700 dark:text-gray-300">
            Capacidad
            <input type="number" min={1} value={draftCapacity} onChange={(e) => setDraftCapacity(e.target.value)} className={`${INPUT} mt-1 block w-24`} />
          </label>
        </div>
      ) : null}
      <RowActions
        editing={editing}
        busy={busy}
        onStartEdit={() => {
          setDraftNumber(String(table.number))
          setDraftCapacity(table.capacity === null ? '' : String(table.capacity))
          setError(null)
          setEditing(true)
        }}
        onCancelEdit={() => setEditing(false)}
        onSave={() =>
          void run(async () => {
            const u = await updateTable(p.restaurantId, table.id, {
              number: Number(draftNumber),
              capacity: draftCapacity === '' ? null : Number(draftCapacity),
            })
            p.onEdited(u)
            setEditing(false)
          }, 'No se pudo guardar.')
        }
        onDelete={() =>
          void run(async () => {
            await deleteTable(p.restaurantId, table.id)
            p.onDeleted(table.id)
          }, 'No se pudo eliminar.')
        }
        deleteConfirmMessage={
          active ? 'La mesa tiene pedidos activos (no se borran). ¿Borrar mesa?' : '¿Borrar esta mesa?'
        }
      />

      {error && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
        <h3 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">Pedidos cargados en la mesa</h3>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Total: {formatMoney(table.total)}</span>
      </div>
      {active ? (
        <TableOrders orders={table.orders} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">La mesa no tiene pedidos activos.</p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => window.open(url, '_blank', 'noopener')}
          className={`${BTN} w-full bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300`}
        >
          Cargar nuevo pedido (Comanda)
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || table.status !== 'occupied'}
            onClick={() => void run(async () => p.onReplace(await requestBill(p.restaurantId, table.id)), 'No se pudo pedir la cuenta.')}
            className={`${BTN} border border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400`}
          >
            {table.status === 'bill' ? 'Cuenta pedida' : 'Pedir cuenta'}
          </button>
          <button
            type="button"
            disabled={busy || !active}
            onClick={() => setConfirming(true)}
            className={`${BTN} border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400`}
          >
            Cobrar y liberar
          </button>
        </div>
        {confirming && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 p-2 text-xs dark:border-gray-700">
            <span className="text-gray-700 dark:text-gray-300">¿Cobrar {formatMoney(table.total)} y liberar la mesa?</span>
            {p.staff.length > 0 && (
              <>
                <label htmlFor="checkout-staff" className="sr-only">Quién cobra</label>
                <select id="checkout-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={INPUT}>
                  <option value="">Sin asignar</option>
                  {p.staff.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(async () => p.onReplace(await checkoutTable(p.restaurantId, table.id, staffId || undefined)), 'No se pudo cobrar la mesa.')}
              className="rounded-md bg-green-700 px-3 py-1 font-medium text-white hover:bg-green-800 disabled:opacity-60"
            >
              Sí, cobrar
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-gray-300 px-3 py-1 text-gray-700 dark:border-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          aria-expanded={showQr}
          className={`${BTN} w-full border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800`}
        >
          QR
        </button>
        {showQr && (
          <dl>
            <QrCodeDisplay value={url} fileName={`mesa-${table.number}-qr.png`} />
          </dl>
        )}
      </div>
    </div>
  )
}

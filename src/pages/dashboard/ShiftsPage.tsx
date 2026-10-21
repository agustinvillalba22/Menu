import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useRestaurantData } from '../../hooks/useRestaurantData'
import { closeShift, getCurrentShift, listShifts, openShift } from '../../lib/shifts'
import { listStaffMembers } from '../../lib/staff'
import { ApiError } from '../../lib/api'
import type { CashShift, StaffMember } from '../../lib/types'
import RestaurantGate from '../../components/dashboard/RestaurantGate'

const inputClass =
  'rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300'
const primaryButtonClass =
  'rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60'
const cardClass = 'rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm'

function money(value: string | null): string {
  if (value === null) return '—'
  const n = parseFloat(value)
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
}

function signedMoney(value: string): string {
  const n = parseFloat(value)
  return `${n > 0 ? '+' : ''}${money(value)}`
}

function differenceClass(value: string): string {
  const n = parseFloat(value)
  if (n < 0) return 'text-red-700 dark:text-red-400'
  if (n > 0) return 'text-amber-700 dark:text-amber-400'
  return 'text-gray-700 dark:text-gray-300'
}

function ordersLabel(count: number): string {
  return `${count} ${count === 1 ? 'pedido' : 'pedidos'}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'shift_already_open') return 'Ya hay un turno abierto.'
    if (err.code === 'shift_already_closed') return 'Este turno ya estaba cerrado.'
    if (err.code === 'staff_member_inactive') return 'La persona elegida está inactiva.'
    if (err.status === 422) return 'Revisá los montos ingresados.'
  }
  return fallback
}

interface ShiftsData {
  staff: StaffMember[]
  current: CashShift | null
  history: CashShift[]
}

const NO_SHIFTS: ShiftsData = { staff: [], current: null, history: [] }

async function loadShifts(restaurantId: string): Promise<ShiftsData> {
  const [members, current, list] = await Promise.all([
    listStaffMembers(restaurantId),
    getCurrentShift(restaurantId),
    listShifts(restaurantId),
  ])
  return {
    staff: members.filter((m) => m.active),
    current,
    history: list.filter((s) => s.closed_at !== null),
  }
}

export default function ShiftsPage(): React.JSX.Element {
  return <RestaurantGate>{(restaurant) => <ShiftsSection restaurantId={restaurant.id} />}</RestaurantGate>
}

function ShiftsSection({ restaurantId }: { restaurantId: string }): React.JSX.Element {
  const { data, setData, loading, error: loadError } = useRestaurantData(
    restaurantId,
    loadShifts,
    NO_SHIFTS,
    'No se pudo cargar la caja.',
  )
  const { staff, current, history } = data
  const [lastClosed, setLastClosed] = useState<CashShift | null>(null)

  const [pickedStaffId, setStaffId] = useState('')
  const staffId = pickedStaffId !== '' ? pickedStaffId : (staff[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleOpen(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      const shift = await openShift(restaurantId, {
        staff_member_id: staffId,
        opening_amount: amount.trim(),
        notes: notes.trim() === '' ? null : notes.trim(),
      })
      setData((prev) => ({ ...prev, current: shift }))
      setLastClosed(null)
      setAmount('')
      setNotes('')
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo abrir el turno.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleClose(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (current === null) return
    setBusy(true)
    setActionError(null)
    try {
      const shift = await closeShift(restaurantId, current.id, {
        staff_member_id: staffId,
        counted_amount: amount.trim(),
        notes: notes.trim() === '' ? null : notes.trim(),
      })
      setLastClosed(shift)
      setData((prev) => ({
        ...prev,
        current: null,
        history: [shift, ...prev.history.filter((s) => s.id !== shift.id)],
      }))
      setAmount('')
      setNotes('')
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo cerrar el turno.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  const amountInvalid = amount.trim() === '' || !/^\d+(\.\d{1,2})?$/.test(amount.trim())

  const staffSelect = (
    <div>
      <label htmlFor="shift-staff" className={labelClass}>
        Responsable
      </label>
      <select id="shift-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass}>
        {staff.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  )

  const notesField = (
    <div>
      <label htmlFor="shift-notes" className={labelClass}>
        Notas
      </label>
      <input
        id="shift-notes"
        type="text"
        maxLength={500}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className={`w-56 ${inputClass}`}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Caja</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Abrí y cerrá turnos de caja con arqueo. El responsable es solo una atribución, no un login.
          Se asume que todo el cobro es en efectivo.
        </p>

        {loadError && (
          <div role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {loadError}
          </div>
        )}

        {!loadError && current === null && staff.length === 0 && (
          <div className="mt-4 rounded-md bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-400">
            No hay personal activo para abrir un turno. Cargá o activá a alguien en{' '}
            <Link to="/dashboard/staff" className="font-medium underline">
              Equipo
            </Link>
            .
          </div>
        )}

        {!loadError && current === null && staff.length > 0 && (
          <form onSubmit={handleOpen} className="mt-4 flex flex-wrap items-end gap-2" noValidate>
            {staffSelect}
            <div>
              <label htmlFor="shift-amount" className={labelClass}>
                Monto inicial
              </label>
              <input
                id="shift-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-28 ${inputClass}`}
              />
            </div>
            {notesField}
            <button type="submit" disabled={busy || amountInvalid || staffId === ''} className={primaryButtonClass}>
              {busy ? 'Abriendo…' : 'Abrir turno'}
            </button>
          </form>
        )}

        {!loadError && current !== null && (
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Abierto por {current.opened_by_name}</p>
              <p>
                Desde {formatDate(current.opened_at)} · Monto inicial{' '}
                <span className="font-medium">{money(current.opening_amount)}</span> ·{' '}
                <span>{ordersLabel(current.orders_count)}</span>
              </p>
              {current.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{current.notes}</p>}
            </div>
            <form onSubmit={handleClose} className="flex flex-wrap items-end gap-2" noValidate>
              {staffSelect}
              <div>
                <label htmlFor="shift-amount" className={labelClass}>
                  Monto contado
                </label>
                <input
                  id="shift-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-28 ${inputClass}`}
                />
              </div>
              {notesField}
              <button type="submit" disabled={busy || amountInvalid || staffId === ''} className={primaryButtonClass}>
                {busy ? 'Cerrando…' : 'Cerrar turno'}
              </button>
            </form>
          </div>
        )}

        {actionError && (
          <div role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">
            {actionError}
          </div>
        )}
      </div>

      {lastClosed && (
        <div data-testid="close-result" className={cardClass}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Turno cerrado</h2>
          <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Esperado</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{money(lastClosed.expected_amount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Contado</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{money(lastClosed.counted_amount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Diferencia</dt>
              <dd className={`font-medium ${differenceClass(lastClosed.difference ?? '0')}`}>
                {money(lastClosed.difference)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className={cardClass}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historial</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Todavía no hay turnos cerrados.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-1 pr-3 font-medium">Apertura</th>
                  <th className="py-1 pr-3 font-medium">Cierre</th>
                  <th className="py-1 pr-3 font-medium">Responsable</th>
                  <th className="py-1 pr-3 font-medium">Esperado</th>
                  <th className="py-1 pr-3 font-medium">Pedidos</th>
                  <th className="py-1 pr-3 font-medium">Contado</th>
                  <th className="py-1 font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 dark:text-gray-100">
                {history.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 pr-3">{formatDate(s.opened_at)}</td>
                    <td className="py-1.5 pr-3">{s.closed_at ? formatDate(s.closed_at) : '—'}</td>
                    <td className="py-1.5 pr-3">
                      {s.opened_by_name}
                      {s.closed_by_name && s.closed_by_name !== s.opened_by_name ? ` → ${s.closed_by_name}` : ''}
                    </td>
                    <td className="py-1.5 pr-3">{money(s.expected_amount)}</td>
                    <td className="py-1.5 pr-3">{ordersLabel(s.orders_count)}</td>
                    <td className="py-1.5 pr-3">{money(s.counted_amount)}</td>
                    <td
                      data-testid={`difference-${s.id}`}
                      className={`py-1.5 font-medium ${differenceClass(s.difference ?? '0')}`}
                    >
                      {s.difference === null ? '—' : signedMoney(s.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

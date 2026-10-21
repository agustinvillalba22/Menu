import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { useRestaurantData } from '../../hooks/useRestaurantData'
import { createStaffMember, deleteStaffMember, listStaffMembers, updateStaffMember } from '../../lib/staff'
import { ApiError } from '../../lib/api'
import type { StaffMember, StaffPosition } from '../../lib/types'
import RowActions from '../../components/dashboard/RowActions'
import RestaurantGate from '../../components/dashboard/RestaurantGate'

const POSITION_OPTIONS: { value: StaffPosition; label: string }[] = [
  { value: 'mozo', label: 'Mozo' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'jefe_cocina', label: 'Jefe de cocina' },
  { value: 'cajero', label: 'Cajero' },
  { value: 'gerente', label: 'Gerente' },
]

const POSITION_LABEL: Record<StaffPosition, string> = {
  mozo: 'Mozo',
  bartender: 'Bartender',
  jefe_cocina: 'Jefe de cocina',
  cajero: 'Cajero',
  gerente: 'Gerente',
}

const NO_MEMBERS: StaffMember[] = []

export default function StaffPage(): React.JSX.Element {
  return <RestaurantGate>{(restaurant) => <StaffSection restaurantId={restaurant.id} />}</RestaurantGate>
}

function StaffSection({ restaurantId }: { restaurantId: string }): React.JSX.Element {
  const {
    data: members,
    setData: setMembers,
    loading,
    error: loadError,
  } = useRestaurantData(restaurantId, listStaffMembers, NO_MEMBERS, 'No se pudo cargar el equipo.')

  const [newName, setNewName] = useState('')
  const [newPosition, setNewPosition] = useState<StaffPosition>('mozo')
  const [newPin, setNewPin] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const member = await createStaffMember(restaurantId, {
        name: newName.trim(),
        position: newPosition,
        pin: newPin,
      })
      setMembers((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewPosition('mozo')
      setNewPin('')
    } catch (err) {
      setCreateError(
        err instanceof ApiError && err.status === 409
          ? 'Ya existe alguien con ese PIN.'
          : 'No se pudo agregar. Revisá que el PIN tenga 4 dígitos.',
      )
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Equipo</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Un roster de identificación del personal (nombre, puesto, PIN de 4 dígitos). No es un
          login — no otorga acceso al dashboard ni cambia lo que cada quien puede ver.
        </p>

        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2" noValidate>
          <div>
            <label htmlFor="new-staff-name" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Nombre
            </label>
            <input
              id="new-staff-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-40 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-staff-position" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Puesto
            </label>
            <select
              id="new-staff-position"
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value as StaffPosition)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-staff-pin" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              PIN (4 dígitos)
            </label>
            <input
              id="new-staff-pin"
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-20 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={creating || newName.trim() === '' || newPin.length !== 4}
            className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Agregando…' : 'Agregar'}
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

      {members.length === 0 && !loadError && (
        <div className="rounded-xl bg-white dark:bg-gray-900 p-6 text-sm text-gray-500 dark:text-gray-400 shadow-sm">
          Todavía no cargaste a nadie del equipo.
        </div>
      )}

      <ul className="space-y-2">
        {members.map((member) => (
          <React.Fragment key={member.id}>
            <StaffRow
              restaurantId={restaurantId}
              member={member}
              onUpdated={(updated) =>
                setMembers((prev) =>
                  prev.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.name.localeCompare(b.name)),
                )
              }
              onDeleted={(id) => setMembers((prev) => prev.filter((m) => m.id !== id))}
            />
          </React.Fragment>
        ))}
      </ul>
    </div>
  )
}

interface StaffRowProps {
  restaurantId: string
  member: StaffMember
  onUpdated: (member: StaffMember) => void
  onDeleted: (staffMemberId: string) => void
}

function StaffRow({ restaurantId, member, onUpdated, onDeleted }: StaffRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(member.name)
  const [draftPosition, setDraftPosition] = useState<StaffPosition>(member.position)
  const [draftPin, setDraftPin] = useState(member.pin)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateStaffMember(restaurantId, member.id, {
        name: draftName,
        position: draftPosition,
        pin: draftPin,
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'Ya existe alguien con ese PIN.'
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
      await deleteStaffMember(restaurantId, member.id)
      onDeleted(member.id)
    } catch {
      setError('No se pudo eliminar.')
      setBusy(false)
    }
  }

  async function toggleActive(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateStaffMember(restaurantId, member.id, { active: !member.active })
      onUpdated(updated)
    } catch {
      setError('No se pudo actualizar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
      {editing ? (
        <div className="flex items-end gap-2">
          <input
            aria-label="Nombre"
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="w-32 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          />
          <select
            aria-label="Puesto"
            value={draftPosition}
            onChange={(e) => setDraftPosition(e.target.value as StaffPosition)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          >
            {POSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            aria-label="PIN"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={draftPin}
            onChange={(e) => setDraftPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-16 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
          />
        </div>
      ) : (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{member.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {POSITION_LABEL[member.position]} · PIN {member.pin}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggleActive()}
          disabled={busy}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
            member.active
              ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          {member.active ? 'Activo' : 'Inactivo'}
        </button>

        {error && <span className="text-xs text-red-700 dark:text-red-400">{error}</span>}

        <RowActions
          editing={editing}
          busy={busy}
          onStartEdit={() => {
            setDraftName(member.name)
            setDraftPosition(member.position)
            setDraftPin(member.pin)
            setError(null)
            setEditing(true)
          }}
          onSave={handleSave}
          onCancelEdit={() => setEditing(false)}
          onDelete={handleDelete}
          deleteConfirmMessage="¿Borrar a esta persona del equipo?"
        />
      </div>
    </li>
  )
}

import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { addModifier, updateModifier, removeModifier } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { Modifier, ModifierType, ModifierUpdate } from '../../lib/types'

interface ItemModifiersProps {
  restaurantId: string
  subcategoryId: string
  itemId: string
  modifiers: Modifier[]
  onModifiersChange: (modifiers: Modifier[]) => void
}

const TYPE_LABEL: Record<ModifierType, string> = {
  extra: 'Extra',
  removal: 'Remoción',
}

/** Signed price label, e.g. "+ $1.50" for extras or "− $2.00" for removals. */
function formatDelta(priceDelta: string): string {
  const value = parseFloat(priceDelta)
  if (Number.isNaN(value)) return priceDelta
  const sign = value < 0 ? '−' : '+'
  return `${sign} $${Math.abs(value).toFixed(2)}`
}

export default function ItemModifiers({
  restaurantId,
  subcategoryId,
  itemId,
  modifiers,
  onModifiersChange,
}: ItemModifiersProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [priceDelta, setPriceDelta] = useState('')
  const [type, setType] = useState<ModifierType>('extra')
  const [busy, setBusy] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPriceDelta, setEditPriceDelta] = useState('')
  const [editType, setEditType] = useState<ModifierType>('extra')

  async function handleAdd(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    setBusy(true)
    setError(null)
    try {
      const created = await addModifier(restaurantId, subcategoryId, itemId, {
        name: trimmed,
        price_delta: priceDelta.trim() === '' ? '0' : priceDelta.trim(),
        type,
      })
      onModifiersChange([...modifiers, created])
      setName('')
      setPriceDelta('')
      setType('extra')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar el modificador.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(modifier: Modifier): void {
    setEditingId(modifier.id)
    setEditName(modifier.name)
    setEditPriceDelta(modifier.price_delta)
    setEditType(modifier.type)
    setError(null)
  }

  async function handleSaveEdit(modifier: Modifier): Promise<void> {
    const patch: ModifierUpdate = {}
    if (editName !== modifier.name) patch.name = editName
    if (editPriceDelta !== modifier.price_delta) patch.price_delta = editPriceDelta
    if (editType !== modifier.type) patch.type = editType
    if (Object.keys(patch).length === 0) {
      setEditingId(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await updateModifier(restaurantId, subcategoryId, itemId, modifier.id, patch)
      onModifiersChange(modifiers.map((m) => (m.id === updated.id ? updated : m)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el modificador.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(modifierId: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await removeModifier(restaurantId, subcategoryId, itemId, modifierId)
      onModifiersChange(modifiers.filter((m) => m.id !== modifierId))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el modificador.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Modificadores
      </p>

      {modifiers.length === 0 && <p className="text-xs text-gray-500">Sin modificadores.</p>}

      <ul className="space-y-1">
        {modifiers.map((modifier) =>
          editingId === modifier.id ? (
            <li key={modifier.id} className="flex flex-wrap items-center gap-2">
              <label htmlFor={`mod-name-${modifier.id}`} className="sr-only">
                Nombre del modificador
              </label>
              <input
                id={`mod-name-${modifier.id}`}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
              />
              <label htmlFor={`mod-price-${modifier.id}`} className="sr-only">
                Precio del modificador
              </label>
              <input
                id={`mod-price-${modifier.id}`}
                type="text"
                inputMode="decimal"
                value={editPriceDelta}
                onChange={(e) => setEditPriceDelta(e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
              />
              <label htmlFor={`mod-type-${modifier.id}`} className="sr-only">
                Tipo del modificador
              </label>
              <select
                id={`mod-type-${modifier.id}`}
                value={editType}
                onChange={(e) => setEditType(e.target.value as ModifierType)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
              >
                <option value="extra">Extra</option>
                <option value="removal">Remoción</option>
              </select>
              <button
                type="button"
                onClick={() => handleSaveEdit(modifier)}
                disabled={busy}
                className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                disabled={busy}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </li>
          ) : (
            <li key={modifier.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 text-gray-700">
                <span className="font-medium">{modifier.name}</span>{' '}
                <span className="text-gray-500">
                  ({TYPE_LABEL[modifier.type]}, {formatDelta(modifier.price_delta)})
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(modifier)}
                  className="text-gray-500 hover:text-gray-900"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(modifier.id)}
                  disabled={busy}
                  aria-label={`Eliminar modificador ${modifier.name}`}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Borrar
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      <form onSubmit={handleAdd} className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor={`new-mod-name-${itemId}`} className="sr-only">
          Nombre del nuevo modificador
        </label>
        <input
          id={`new-mod-name-${itemId}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
        />
        <label htmlFor={`new-mod-price-${itemId}`} className="sr-only">
          Precio del nuevo modificador
        </label>
        <input
          id={`new-mod-price-${itemId}`}
          type="text"
          inputMode="decimal"
          value={priceDelta}
          onChange={(e) => setPriceDelta(e.target.value)}
          placeholder="+/- $"
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
        />
        <label htmlFor={`new-mod-type-${itemId}`} className="sr-only">
          Tipo del nuevo modificador
        </label>
        <select
          id={`new-mod-type-${itemId}`}
          value={type}
          onChange={(e) => setType(e.target.value as ModifierType)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
        >
          <option value="extra">Extra</option>
          <option value="removal">Remoción</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Agregar
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

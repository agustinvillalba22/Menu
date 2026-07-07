import React, { useState } from 'react'
import { updateItem, deleteItem } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { Item, ItemUpdate, Tag } from '../../lib/types'
import ItemTags from './ItemTags'
import ItemModifiers from './ItemModifiers'

interface ItemRowProps {
  restaurantId: string
  subcategoryId: string
  item: Item
  onDeleted: (itemId: string) => void
}

export default function ItemRow({
  restaurantId,
  subcategoryId,
  item,
  onDeleted,
}: ItemRowProps): React.JSX.Element {
  const [current, setCurrent] = useState<Item>(item)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description)
  const [price, setPrice] = useState(item.price)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(): void {
    setName(current.name)
    setDescription(current.description)
    setPrice(current.price)
    setError(null)
    setEditing(true)
  }

  async function handleSave(): Promise<void> {
    const patch: ItemUpdate = {}
    if (name !== current.name) patch.name = name
    if (description !== current.description) patch.description = description
    if (price !== current.price) patch.price = price // always a string
    if (Object.keys(patch).length === 0) {
      setEditing(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await updateItem(restaurantId, subcategoryId, current.id, patch)
      setCurrent(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el ítem.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await deleteItem(restaurantId, subcategoryId, current.id)
      onDeleted(current.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el ítem.')
      setBusy(false)
    }
  }

  function handleTagsChange(tags: Tag[]): void {
    setCurrent((prev) => ({ ...prev, tags }))
  }

  return (
    <li className="rounded-md border border-gray-200 p-3">
      {editing ? (
        <div className="space-y-2">
          <div>
            <label htmlFor={`item-name-${current.id}`} className="sr-only">
              Nombre del ítem
            </label>
            <input
              id={`item-name-${current.id}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor={`item-desc-${current.id}`} className="sr-only">
              Descripción del ítem
            </label>
            <input
              id={`item-desc-${current.id}`}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor={`item-price-${current.id}`} className="sr-only">
              Precio del ítem
            </label>
            <input
              id={`item-price-${current.id}`}
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Precio"
              className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{current.name}</p>
            {current.description && (
              <p className="text-xs text-gray-500">{current.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              ${parseFloat(current.price).toFixed(2)}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Borrar
            </button>
          </div>
        </div>
      )}

      <ItemTags
        restaurantId={restaurantId}
        subcategoryId={subcategoryId}
        itemId={current.id}
        tags={current.tags}
        onTagsChange={handleTagsChange}
      />

      <ItemModifiers
        restaurantId={restaurantId}
        subcategoryId={subcategoryId}
        itemId={current.id}
      />

      {error && (
        <div role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </div>
      )}
    </li>
  )
}

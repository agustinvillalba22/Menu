import React, { useEffect, useState } from 'react'
import { updateItem, deleteItem, listModifiers } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { Item, ItemUpdate, Modifier, Tag } from '../../lib/types'
import ItemTags from './ItemTags'
import ItemModifiers from './ItemModifiers'
import ItemImageUpload from './ItemImageUpload'
import RowActions from './RowActions'

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

  // Tags/modifiers are collapsed by default (RF-03) — the tag count comes
  // from the item itself. ItemRow is the single source of truth for the
  // modifiers list: it fetches once on mount and passes the list down to
  // ItemModifiers as a controlled prop (M12.4) instead of letting
  // ItemModifiers fetch it again itself.
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [modifiersExpanded, setModifiersExpanded] = useState(false)
  const [modifiers, setModifiers] = useState<Modifier[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listModifiers(restaurantId, subcategoryId, current.id)
      .then((list) => {
        if (!cancelled) setModifiers(list)
      })
      .catch(() => {
        if (!cancelled) setModifiers([])
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, subcategoryId, current.id])

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

  function handleImageChange(imageUrl: string | null): void {
    setCurrent((prev) => ({ ...prev, image_url: imageUrl }))
  }

  return (
    <li className="pt-3 pr-3 pb-3 pl-12 rounded-md border border-gray-200">
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
          <RowActions
            editing
            busy={busy}
            onStartEdit={startEdit}
            onSave={handleSave}
            onCancelEdit={() => setEditing(false)}
            onDelete={handleDelete}
            deleteConfirmMessage="¿Confirmar borrado del ítem?"
          />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{current.name}</p>
            {current.description && (
              <p className="text-xs text-gray-500">{current.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-medium text-gray-900">
              ${parseFloat(current.price).toFixed(2)}
            </span>
            <RowActions
              editing={false}
              busy={busy}
              onStartEdit={startEdit}
              onSave={handleSave}
              onCancelEdit={() => setEditing(false)}
              onDelete={handleDelete}
              deleteConfirmMessage="¿Confirmar borrado del ítem?"
            />
          </div>
        </div>
      )}

      <ItemImageUpload
        restaurantId={restaurantId}
        subcategoryId={subcategoryId}
        itemId={current.id}
        imageUrl={current.image_url}
        onImageChange={handleImageChange}
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTagsExpanded((v) => !v)}
          aria-expanded={tagsExpanded}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Tags ({current.tags.length}) {tagsExpanded ? '▾' : '▸'}
        </button>
        <button
          type="button"
          onClick={() => setModifiersExpanded((v) => !v)}
          aria-expanded={modifiersExpanded}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Modificadores ({modifiers?.length ?? 0}) {modifiersExpanded ? '▾' : '▸'}
        </button>
      </div>

      {tagsExpanded && (
        <ItemTags
          restaurantId={restaurantId}
          subcategoryId={subcategoryId}
          itemId={current.id}
          tags={current.tags}
          onTagsChange={handleTagsChange}
        />
      )}

      {modifiersExpanded && modifiers !== null && (
        <ItemModifiers
          restaurantId={restaurantId}
          subcategoryId={subcategoryId}
          itemId={current.id}
          modifiers={modifiers}
          onModifiersChange={setModifiers}
        />
      )}
      {modifiersExpanded && modifiers === null && (
        <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
          Cargando modificadores…
        </p>
      )}

      {error && (
        <div role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </div>
      )}
    </li>
  )
}

import React, { useState } from 'react'
import {
  listItems,
  createItem,
  updateSubcategory,
  deleteSubcategory,
} from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { Item, ItemCreate, Subcategory } from '../../lib/types'
import ItemRow from './ItemRow'
import ItemCreateForm from './ItemCreateForm'
import RowHeader from './RowHeader'

interface SubcategoryRowProps {
  restaurantId: string
  categoryId: string
  subcategory: Subcategory
  onDeleted: (subcategoryId: string) => void
}

export default function SubcategoryRow({
  restaurantId,
  categoryId,
  subcategory,
  onDeleted,
}: SubcategoryRowProps): React.JSX.Element {
  const [name, setName] = useState(subcategory.name)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(subcategory.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)

  async function toggleExpand(): Promise<void> {
    const next = !expanded
    setExpanded(next)
    if (next && !loaded) {
      setItemsLoading(true)
      setItemsError(null)
      try {
        setItems(await listItems(restaurantId, subcategory.id))
        setLoaded(true)
      } catch {
        setItemsError('No se pudieron cargar los ítems.')
      } finally {
        setItemsLoading(false)
      }
    }
  }

  async function handleSaveName(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      // SubcategoryUpdate.name is REQUIRED by the backend — always send it.
      const updated = await updateSubcategory(restaurantId, categoryId, subcategory.id, {
        name: draftName,
      })
      setName(updated.name)
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await deleteSubcategory(restaurantId, categoryId, subcategory.id)
      onDeleted(subcategory.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.')
      setBusy(false)
    }
  }

  async function handleCreateItem(data: ItemCreate): Promise<boolean> {
    setItemsError(null)
    try {
      const item = await createItem(restaurantId, subcategory.id, data)
      setItems((prev) => [...prev, item])
      return true
    } catch (err) {
      setItemsError(err instanceof ApiError ? err.message : 'No se pudo crear el ítem.')
      return false
    }
  }

  return (
    <li className="rounded-md border border-gray-200 bg-white">
      <RowHeader
        inputId={`sub-name-${subcategory.id}`}
        label="Nombre de la subcategoría"
        name={name}
        expanded={expanded}
        onToggleExpand={toggleExpand}
        editing={editing}
        draftName={draftName}
        onDraftChange={setDraftName}
        onStartEdit={() => {
          setDraftName(name)
          setError(null)
          setEditing(true)
        }}
        onSaveName={handleSaveName}
        onCancelEdit={() => setEditing(false)}
        onDelete={handleDelete}
        busy={busy}
        padding="pt-2 pr-3 pb-2 pl-8"
        nameClassName="text-sm font-medium text-gray-800"
        deleteConfirmMessage="Se borrará también todo lo que contiene (ítems). ¿Confirmar?"
      />

      {error && (
        <div role="alert" className="px-3 pb-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3">
          {itemsLoading && <p className="text-xs text-gray-500">Cargando ítems…</p>}
          {itemsError && (
            <div role="alert" className="mb-2 text-xs text-red-700">
              {itemsError}
            </div>
          )}
          {loaded && (
            <ul className="space-y-2">
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  <ItemRow
                    restaurantId={restaurantId}
                    subcategoryId={subcategory.id}
                    item={item}
                    onDeleted={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                  />
                </React.Fragment>
              ))}
            </ul>
          )}

          <ItemCreateForm subcategoryId={subcategory.id} onCreate={handleCreateItem} />
        </div>
      )}
    </li>
  )
}

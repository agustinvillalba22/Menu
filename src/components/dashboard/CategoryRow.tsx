import React, { useState } from 'react'
import type { FormEvent } from 'react'
import {
  listSubcategories,
  createSubcategory,
  updateCategory,
  deleteCategory,
} from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { Category, Subcategory } from '../../lib/types'
import SubcategoryRow from './SubcategoryRow'
import RowHeader from './RowHeader'

interface CategoryRowProps {
  restaurantId: string
  category: Category
  onDeleted: (categoryId: string) => void
}

export default function CategoryRow({
  restaurantId,
  category,
  onDeleted,
}: CategoryRowProps): React.JSX.Element {
  const [name, setName] = useState(category.name)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(category.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [subsError, setSubsError] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [creatingSub, setCreatingSub] = useState(false)

  async function toggleExpand(): Promise<void> {
    const next = !expanded
    setExpanded(next)
    if (next && !loaded) {
      setSubsLoading(true)
      setSubsError(null)
      try {
        setSubcategories(await listSubcategories(restaurantId, category.id))
        setLoaded(true)
      } catch {
        setSubsError('No se pudieron cargar las subcategorías.')
      } finally {
        setSubsLoading(false)
      }
    }
  }

  async function handleSaveName(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      // PATCH only the changed field (name); type is left untouched.
      const updated = await updateCategory(restaurantId, category.id, { name: draftName })
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
      await deleteCategory(restaurantId, category.id)
      onDeleted(category.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.')
      setBusy(false)
    }
  }

  async function handleCreateSub(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setCreatingSub(true)
    setSubsError(null)
    try {
      const sub = await createSubcategory(restaurantId, category.id, { name: newSubName })
      setSubcategories((prev) => [...prev, sub])
      setNewSubName('')
    } catch (err) {
      setSubsError(err instanceof ApiError ? err.message : 'No se pudo crear la subcategoría.')
    } finally {
      setCreatingSub(false)
    }
  }

  return (
    <li className="rounded-xl bg-white shadow-sm">
      <RowHeader
        inputId={`cat-name-${category.id}`}
        label="Nombre de la categoría"
        name={name}
        badge={
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {category.type === 'food' ? 'Comida' : 'Bebida'}
          </span>
        }
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
        padding="pt-3 pr-4 pb-3 pl-4"
        nameClassName="text-sm font-semibold text-gray-900"
        deleteConfirmMessage="Se borrará también todo lo que contiene (subcategorías e ítems). ¿Confirmar?"
      />

      {error && (
        <div role="alert" className="px-4 pb-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          {subsLoading && <p className="text-xs text-gray-500">Cargando subcategorías…</p>}
          {subsError && (
            <div role="alert" className="mb-2 text-xs text-red-700">
              {subsError}
            </div>
          )}
          {loaded && (
            <ul className="space-y-2">
              {subcategories.map((sub) => (
                <React.Fragment key={sub.id}>
                  <SubcategoryRow
                    restaurantId={restaurantId}
                    categoryId={category.id}
                    subcategory={sub}
                    onDeleted={(id) =>
                      setSubcategories((prev) => prev.filter((s) => s.id !== id))
                    }
                  />
                </React.Fragment>
              ))}
            </ul>
          )}

          <form onSubmit={handleCreateSub} className="mt-3 flex items-end gap-2">
            <div>
              <label htmlFor={`new-sub-${category.id}`} className="sr-only">
                Nombre de la nueva subcategoría
              </label>
              <input
                id={`new-sub-${category.id}`}
                type="text"
                required
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Nueva subcategoría"
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={creatingSub}
              className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {creatingSub ? 'Agregando…' : 'Agregar subcategoría'}
            </button>
          </form>
        </div>
      )}
    </li>
  )
}

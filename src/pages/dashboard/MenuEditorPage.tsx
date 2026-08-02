import React, { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { listCategories, createCategory } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import { getCategoryIconOptions, NO_ICON_VALUE } from '../../lib/categoryIcons'
import type { Category, CategoryIcon, CategoryType } from '../../lib/types'
import CategoryRow from '../../components/dashboard/CategoryRow'

const ICON_OPTIONS = getCategoryIconOptions()

export default function MenuEditorPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CategoryType>('food')
  // P8: null = text-only chip. NO_ICON_VALUE is the select placeholder code
  // that decodes back into `null` on submit — `<select>` can't carry null.
  const [newIcon, setNewIcon] = useState<CategoryIcon | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (restaurantId === null) return
    let cancelled = false

    async function load(id: string): Promise<void> {
      setLoading(true)
      setLoadError(null)
      try {
        const list = await listCategories(id)
        if (!cancelled) setCategories(list)
      } catch {
        if (!cancelled) setLoadError('No se pudieron cargar las categorías.')
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
      // Omit `icon` entirely when null — the backend defaults to null, and
      // keeping the payload minimal matches the existing test contract that
      // asserts POST body == { name, type } for an icon-less category.
      const payload = { name: newName, type: newType } as {
        name: string
        type: CategoryType
        icon?: CategoryIcon
      }
      if (newIcon !== null) payload.icon = newIcon
      const category = await createCategory(restaurantId, payload)
      setCategories((prev) => [...prev, category])
      setNewName('')
      setNewType('food')
      setNewIcon(null)
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear la categoría.')
    } finally {
      setCreating(false)
    }
  }

  if (restaurantLoading) {
    return <p className="text-sm text-gray-600">Cargando…</p>
  }

  if (restaurantError) {
    return (
      <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {restaurantError}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <p className="text-sm text-gray-600">
        Creá tu restaurante primero desde “Mi restaurante”.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Menú</h1>

        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="cat-name" className="mb-1 block text-sm font-medium text-gray-700">
              Nueva categoría
            </label>
            <input
              id="cat-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="cat-type" className="mb-1 block text-sm font-medium text-gray-700">
              Tipo
            </label>
            <select
              id="cat-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as CategoryType)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="food">Comida</option>
              <option value="drink">Bebida</option>
            </select>
          </div>
          <div>
            <label htmlFor="cat-icon" className="mb-1 block text-sm font-medium text-gray-700">
              Ícono
            </label>
            <select
              id="cat-icon"
              value={newIcon ?? NO_ICON_VALUE}
              onChange={(e) =>
                setNewIcon(e.target.value === NO_ICON_VALUE ? null : (e.target.value as CategoryIcon))
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value={NO_ICON_VALUE}>Sin ícono</option>
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Agregando…' : 'Agregar categoría'}
          </button>
        </form>

        {createError && (
          <div role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {createError}
          </div>
        )}

        <div className="mt-6">
          {loading && <p className="text-sm text-gray-500">Cargando categorías…</p>}
          {loadError && (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </div>
          )}
          {!loading && !loadError && categories.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no hay categorías.</p>
          )}
          {categories.length > 0 && (
            <ul className="space-y-3">
              {categories.map((category) => (
                <React.Fragment key={category.id}>
                  <CategoryRow
                    restaurantId={restaurant.id}
                    category={category}
                    onDeleted={(id) =>
                      setCategories((prev) => prev.filter((c) => c.id !== id))
                    }
                  />
                </React.Fragment>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

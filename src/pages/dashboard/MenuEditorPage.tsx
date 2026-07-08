import React, { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { listCategories, createCategory } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { Category, CategoryType } from '../../lib/types'
import CategoryRow from '../../components/dashboard/CategoryRow'

export default function MenuEditorPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CategoryType>('food')
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
      const category = await createCategory(restaurantId, { name: newName, type: newType })
      setCategories((prev) => [...prev, category])
      setNewName('')
      setNewType('food')
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

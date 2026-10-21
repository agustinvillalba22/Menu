import React, { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { listMenus, createMenu, listCategoriesForMenu, createCategoryForMenu } from '../../lib/menus'
import { menuErrorMessage } from '../../lib/menuErrors'
import { ApiError } from '../../lib/api'
import { getCategoryIconOptions, NO_ICON_VALUE } from '../../lib/categoryIcons'
import type { Category, CategoryIcon, CategoryType, Menu } from '../../lib/types'
import CategoryRow from '../../components/dashboard/CategoryRow'
import MenuTabs from '../../components/dashboard/MenuTabs'
import MenuSettingsPanel from '../../components/dashboard/MenuSettingsPanel'

const ICON_OPTIONS = getCategoryIconOptions()

const storageKey = (restaurantId: string): string => `menu-editor-active-menu:${restaurantId}`

function readStoredMenuId(restaurantId: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(restaurantId))
  } catch {
    return null
  }
}

function storeMenuId(restaurantId: string, menuId: string): void {
  try {
    sessionStorage.setItem(storageKey(restaurantId), menuId)
  } catch {
    /* storage unavailable: the tab just isn't remembered */
  }
}

const byName = (a: Menu, b: Menu): number => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })

export default function MenuEditorPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [menus, setMenus] = useState<Menu[]>([])
  const [menusLoaded, setMenusLoaded] = useState(false)
  const [menusError, setMenusError] = useState<string | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

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

  // Load the restaurant's menus; restore the remembered tab (or the default).
  useEffect(() => {
    if (restaurantId === null) return
    let cancelled = false
    setMenusLoaded(false)
    setMenusError(null)
    listMenus(restaurantId)
      .then((list) => {
        if (cancelled) return
        const sorted = [...list].sort(byName)
        const stored = readStoredMenuId(restaurantId)
        const initial =
          sorted.find((m) => m.id === stored) ?? sorted.find((m) => m.is_default) ?? sorted[0] ?? null
        setMenus(sorted)
        setActiveMenuId(initial?.id ?? null)
        setMenusLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setMenusError('No se pudieron cargar los menús.')
        setMenusLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  // Reload the categories whenever the active tab changes.
  useEffect(() => {
    if (restaurantId === null || activeMenuId === null) return
    let cancelled = false

    async function load(rid: string, mid: string): Promise<void> {
      setCategories([])
      setLoading(true)
      setLoadError(null)
      try {
        const list = await listCategoriesForMenu(rid, mid)
        if (!cancelled) setCategories(list)
      } catch {
        if (!cancelled) setLoadError('No se pudieron cargar las categorías.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load(restaurantId, activeMenuId)
    return () => {
      cancelled = true
    }
  }, [restaurantId, activeMenuId])

  function selectMenu(menuId: string): void {
    setActiveMenuId(menuId)
    if (restaurantId !== null) storeMenuId(restaurantId, menuId)
  }

  async function handleCreateMenu(name: string): Promise<string | null> {
    if (restaurantId === null) return null
    try {
      const created = await createMenu(restaurantId, { name })
      setMenus((prev) => [...prev, created].sort(byName))
      selectMenu(created.id)
      return null
    } catch (err) {
      return menuErrorMessage(err, 'No se pudo crear el menú.')
    }
  }

  function handleMenuUpdated(updated: Menu): void {
    setMenus((prev) =>
      prev
        .map((m) => (m.id === updated.id ? updated : updated.is_default ? { ...m, is_default: false } : m))
        .sort(byName),
    )
  }

  function handleMenuDeleted(menuId: string): void {
    const remaining = menus.filter((m) => m.id !== menuId)
    const wasDefault = menus.find((m) => m.id === menuId)?.is_default ?? false
    // The server promotes the first remaining menu by name to default.
    const next = wasDefault
      ? remaining.map((m, i) => (i === 0 ? { ...m, is_default: true } : m))
      : remaining
    setMenus(next)
    if (activeMenuId === menuId) {
      const fallback = next.find((m) => m.is_default) ?? next[0] ?? null
      if (fallback) selectMenu(fallback.id)
      else setActiveMenuId(null)
    }
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (restaurantId === null || activeMenuId === null) return
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
      const category = await createCategoryForMenu(restaurantId, activeMenuId, payload)
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
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  if (restaurantError) {
    return (
      <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {restaurantError}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Creá tu restaurante primero desde “Mi restaurante”.
      </p>
    )
  }

  const activeMenu = menus.find((m) => m.id === activeMenuId) ?? null

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Menú</h1>

        {menusError && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {menusError}
          </div>
        )}
        {!menusLoaded && <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Cargando menús…</p>}
        {activeMenu && (
          <>
            <MenuTabs menus={menus} activeId={activeMenu.id} onCreate={handleCreateMenu} onSelect={selectMenu} />
            <MenuSettingsPanel
              restaurantId={restaurant.id}
              menu={activeMenu}
              onUpdated={handleMenuUpdated}
              onDeleted={handleMenuDeleted}
            />
          </>
        )}

        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="cat-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nueva categoría
            </label>
            <input
              id="cat-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre"
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="cat-type" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo
            </label>
            <select
              id="cat-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as CategoryType)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            >
              <option value="food">Comida</option>
              <option value="drink">Bebida</option>
            </select>
          </div>
          <div>
            <label htmlFor="cat-icon" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Ícono
            </label>
            <select
              id="cat-icon"
              value={newIcon ?? NO_ICON_VALUE}
              onChange={(e) =>
                setNewIcon(e.target.value === NO_ICON_VALUE ? null : (e.target.value as CategoryIcon))
              }
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
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
            className="rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Agregando…' : 'Agregar categoría'}
          </button>
        </form>

        {createError && (
          <div role="alert" className="mt-4 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {createError}
          </div>
        )}

        <div className="mt-6">
          {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Cargando categorías…</p>}
          {loadError && (
            <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {loadError}
            </div>
          )}
          {!loading && !loadError && categories.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Todavía no hay categorías.</p>
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

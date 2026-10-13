import React, { useState } from 'react'
import type { FormEvent } from 'react'
import type { Menu } from '../../lib/types'

interface MenuTabsProps {
  menus: Menu[]
  activeId: string
  /** Resolves with an error message, or null on success. */
  onCreate: (name: string) => Promise<string | null>
  onSelect: (menuId: string) => void
}

/** Tab bar with one tab per menu (default marked "Principal") + "+ Nuevo menú". */
export default function MenuTabs({ menus, activeId, onCreate, onSelect }: MenuTabsProps): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await onCreate(name.trim())
    setBusy(false)
    if (err === null) {
      setName('')
      setAdding(false)
    } else {
      setError(err)
    }
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <div role="tablist" aria-label="Menús" className="flex flex-wrap items-center gap-2">
          {menus.map((m) => {
            const active = m.id === activeId
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(m.id)}
                className={
                  active
                    ? 'rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900'
                    : 'rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              >
                {m.name}
                {m.is_default && (
                  <span className="ml-2 rounded bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                    Principal
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            + Nuevo menú
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="new-menu-name" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Nombre del nuevo menú
            </label>
            <input
              id="new-menu-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Creando…' : 'Crear menú'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAdding(false)
              setName('')
              setError(null)
            }}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            Cancelar
          </button>
        </form>
      )}
      {error && (
        <div role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { importItemsCsv } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { ImportResult, Menu } from '../../lib/types'

interface CsvImportFormProps {
  restaurantId: string
  /** Called after a successful import that created at least one row, so the
   *  caller can refresh the already-rendered category tree. */
  onImported?: (result: ImportResult) => void
  /** Optional loader for the restaurant's menus. With 2+ menus a target-menu
   *  selector is shown; on failure the form silently imports to the default. */
  loadMenus?: () => Promise<Menu[]>
}

export default function CsvImportForm({
  restaurantId,
  onImported,
  loadMenus,
}: CsvImportFormProps): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null)
  const [createMissing, setCreateMissing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [menuId, setMenuId] = useState('')
  const [importedMenuName, setImportedMenuName] = useState<string | null>(null)

  // loadMenus is intentionally read once per restaurant (callers pass inline closures).
  useEffect(() => {
    if (!loadMenus) return
    let cancelled = false
    loadMenus()
      .then((list) => {
        if (cancelled) return
        setMenus(list)
        setMenuId(list.find((m) => m.is_default)?.id ?? list[0]?.id ?? '')
      })
      .catch(() => {
        if (!cancelled) setMenus([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const showMenuSelect = menus.length >= 2

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (file === null) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const target = showMenuSelect ? menus.find((m) => m.id === menuId) : undefined
      const res = await importItemsCsv(restaurantId, file, createMissing, target?.id)
      setImportedMenuName(target && !target.is_default ? target.name : null)
      setResult(res)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      if (res.imported > 0) onImported?.(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo importar el archivo.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Importar CSV</h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Cargá ítems de forma masiva desde un archivo CSV.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="csv-file" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Archivo CSV
          </label>
          <input
            id="csv-file"
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-700 dark:text-gray-300"
          />
        </div>
        {showMenuSelect && (
          <div>
            <label htmlFor="csv-menu" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Menú destino
            </label>
            <select
              id="csv-menu"
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.is_default ? `${m.name} (principal)` : m.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            id="csv-create-missing"
            type="checkbox"
            checked={createMissing}
            onChange={(e) => setCreateMissing(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
          />
          <label htmlFor="csv-create-missing" className="text-sm text-gray-700 dark:text-gray-300">
            Crear categorías/subcategorías que no existan
          </label>
        </div>
        <button
          type="submit"
          disabled={importing || file === null}
          className="rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importing ? 'Importando…' : 'Importar'}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-4 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-2">
          <div role="status" className="rounded-md bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            {result.imported} importado{result.imported === 1 ? '' : 's'}
            {importedMenuName ? ` en «${importedMenuName}»` : ''}
          </div>
          {result.errors.length > 0 && (
            <ul className="space-y-1 text-sm text-red-700 dark:text-red-400">
              {result.errors.map((err, idx) => (
                <li key={`${err.row}-${idx}`}>
                  Fila {err.row}: {err.reason}
                  {err.detail ? ` (${err.detail})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

import React, { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { importItemsCsv } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import type { ImportResult } from '../../lib/types'

interface CsvImportFormProps {
  restaurantId: string
  /** Called after a successful import that created at least one row, so the
   *  caller can refresh the already-rendered category tree (RF-05). */
  onImported?: (result: ImportResult) => void
}

export default function CsvImportForm({
  restaurantId,
  onImported,
}: CsvImportFormProps): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null)
  const [createMissing, setCreateMissing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (file === null) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const res = await importItemsCsv(restaurantId, file, createMissing)
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
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Importar CSV</h2>
      <p className="mb-4 text-sm text-gray-500">
        Cargá ítems de forma masiva desde un archivo CSV.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="csv-file" className="mb-1 block text-sm font-medium text-gray-700">
            Archivo CSV
          </label>
          <input
            id="csv-file"
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="csv-create-missing"
            type="checkbox"
            checked={createMissing}
            onChange={(e) => setCreateMissing(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="csv-create-missing" className="text-sm text-gray-700">
            Crear categorías/subcategorías que no existan
          </label>
        </div>
        <button
          type="submit"
          disabled={importing || file === null}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importing ? 'Importando…' : 'Importar'}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-2">
          <div role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {result.imported} importado{result.imported === 1 ? '' : 's'}
          </div>
          {result.errors.length > 0 && (
            <ul className="space-y-1 text-sm text-red-700">
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

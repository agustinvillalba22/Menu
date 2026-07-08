import React, { useEffect, useState } from 'react'
import { listAdminRestaurants, updateAdminRestaurant } from '../../lib/admin'
import type { AdminRestaurant } from '../../lib/types'
import Toggle from '../../components/ui/Toggle'
import CsvImportForm from '../../components/dashboard/CsvImportForm'

export default function AdminRestaurantsPage(): React.JSX.Element {
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  // RF-06: at most one row's import form is open at a time (inline expand).
  const [importOpenId, setImportOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const list = await listAdminRestaurants()
        if (!cancelled) setRestaurants(list)
      } catch {
        if (!cancelled) setError('No se pudieron cargar los restaurantes.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // CA-04: PATCH only {is_active}.
  async function handleToggleActive(restaurant: AdminRestaurant): Promise<void> {
    setTogglingId(restaurant.id)
    setError(null)
    try {
      const updated = await updateAdminRestaurant(restaurant.id, {
        is_active: !restaurant.is_active,
      })
      setRestaurants((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch {
      setError('No se pudo actualizar el restaurante.')
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Cargando…</p>
  }

  if (error && restaurants.length === 0) {
    return (
      <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Restaurantes</h1>

      {error && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {restaurants.length === 0 ? (
        <p className="text-sm text-gray-500">No hay restaurantes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Slug</th>
                <th className="py-2 pr-4 font-medium">Owner</th>
                <th className="py-2 pr-4 font-medium">Activo</th>
                <th className="py-2 pr-4 font-medium">Pedidos</th>
                <th className="py-2 pr-4 font-medium">Import CSV</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-900">{r.name}</td>
                    <td className="py-2 pr-4 text-gray-900">{r.slug}</td>
                    <td className="py-2 pr-4 text-gray-900">{r.owner_email ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <Toggle
                        checked={r.is_active}
                        label={`Activo — ${r.name}`}
                        disabled={togglingId === r.id}
                        onToggle={() => handleToggleActive(r)}
                      />
                    </td>
                    {/* Read-only per RF-06 — plain text, not an interactive switch. */}
                    <td className="py-2 pr-4 text-gray-900">{r.orders_enabled ? 'Sí' : 'No'}</td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        aria-expanded={importOpenId === r.id}
                        onClick={() => setImportOpenId(importOpenId === r.id ? null : r.id)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {importOpenId === r.id ? 'Cerrar' : 'Importar CSV'}
                      </button>
                    </td>
                  </tr>
                  {importOpenId === r.id && (
                    <tr>
                      <td colSpan={6} className="pb-4">
                        <CsvImportForm restaurantId={r.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

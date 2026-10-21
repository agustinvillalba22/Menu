import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { createRestaurant, isOwner, updateRestaurant } from '../../lib/restaurants'
import type { RestaurantUpdate } from '../../lib/types'
import QrCodeDisplay from '../../components/dashboard/QrCodeDisplay'

export default function OverviewPage(): React.JSX.Element {
  const { restaurant, loading, error, reload } = useMyRestaurant()

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [togglingOrders, setTogglingOrders] = useState(false)
  const [ordersStatus, setOrdersStatus] = useState<'success' | 'error' | null>(null)

  async function handleToggleOrders(nextEnabled: boolean): Promise<void> {
    if (!restaurant) return
    setOrdersStatus(null)
    setTogglingOrders(true)
    // PATCH-diffed: `name` is required by the backend schema, so it is always
    // sent unchanged; `orders_enabled` is the only field that actually changes.
    const patch: RestaurantUpdate = { name: restaurant.name }
    if (nextEnabled !== restaurant.orders_enabled) patch.orders_enabled = nextEnabled
    try {
      await updateRestaurant(restaurant.id, patch)
      await reload()
      setOrdersStatus('success')
    } catch {
      setOrdersStatus('error')
    } finally {
      setTogglingOrders(false)
    }
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await createRestaurant({ name })
      setName('')
      await reload()
    } catch {
      setFormError('No se pudo crear el restaurante. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Creá tu restaurante</h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          Todavía no tenés un restaurante. Empezá poniéndole un nombre.
        </p>

        {formError && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nombre del restaurante
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || name.trim() === ''}
            className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creando…' : 'Crear restaurante'}
          </button>
        </form>
      </div>
    )
  }

  const publicPath = `/menu/${restaurant.qr_token}`
  // URL absoluta para el QR — el celular que escanea no tiene "origin" propio.
  const publicUrl = `${window.location.origin}${publicPath}`
  // PATCH /restaurants/{id} (incl. orders_enabled) is owner-only
  // on the backend — the toggle is disabled for editor instead of silently
  // 403ing on click.
  const canEditOrders = isOwner(restaurant)

  return (
    <div className="max-w-2xl rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{restaurant.name}</h1>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Slug</dt>
          <dd className="text-gray-900 dark:text-gray-100">{restaurant.slug}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Menú público</dt>
          <dd>
            <Link to={publicPath} className="font-medium text-gray-900 dark:text-gray-100 underline break-all">
              {publicPath}
            </Link>
          </dd>
        </div>
        <QrCodeDisplay value={publicUrl} fileName={`${restaurant.slug}-qr.png`} />
      </dl>

      <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Recepción de pedidos</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {restaurant.orders_enabled
                ? 'Los clientes pueden hacer pedidos desde el menú público.'
                : 'Los pedidos están desactivados. Activalos para recibirlos en Pedidos.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={restaurant.orders_enabled}
            aria-label="Recepción de pedidos"
            aria-describedby={canEditOrders ? undefined : 'orders-toggle-owner-only'}
            disabled={togglingOrders || !canEditOrders}
            onClick={() => handleToggleOrders(!restaurant.orders_enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              restaurant.orders_enabled ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-900 transition-transform ${
                restaurant.orders_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {!canEditOrders && (
          <p id="orders-toggle-owner-only" className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Solo el administrador del restaurante puede modificar esto.
          </p>
        )}

        {ordersStatus === 'success' && (
          <div role="status" className="mt-3 rounded-md bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            Preferencia de pedidos guardada.
          </div>
        )}
        {ordersStatus === 'error' && (
          <div role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            No se pudo guardar la preferencia de pedidos.
          </div>
        )}
      </div>
    </div>
  )
}

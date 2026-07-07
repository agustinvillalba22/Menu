import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { listOrders, updateOrderStatus } from '../../lib/orders'
import type { OrderRead, OrderStatus, OrderType } from '../../lib/types'

const POLL_INTERVAL_MS = 10_000

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  ready: 'Listo',
  completed: 'Entregado',
  cancelled: 'Cancelado',
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  ready: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  mesa: 'Mesa',
  llevar: 'Para llevar',
  envio: 'Envío',
}

interface Transition {
  label: string
  next: OrderStatus
  variant: 'primary' | 'danger'
}

/** Valid forward transitions offered per status (mirrors backend RF-07). */
function transitionsFor(status: OrderStatus): Transition[] {
  switch (status) {
    case 'pending':
      return [
        { label: 'Aceptar', next: 'accepted', variant: 'primary' },
        { label: 'Cancelar', next: 'cancelled', variant: 'danger' },
      ]
    case 'accepted':
      return [
        { label: 'Marcar listo', next: 'ready', variant: 'primary' },
        { label: 'Cancelar', next: 'cancelled', variant: 'danger' },
      ]
    case 'ready':
      return [
        { label: 'Marcar entregado', next: 'completed', variant: 'primary' },
        { label: 'Cancelar', next: 'cancelled', variant: 'danger' },
      ]
    default:
      return []
  }
}

function formatDelta(priceDelta: string): string {
  const value = parseFloat(priceDelta)
  if (Number.isNaN(value)) return priceDelta
  const sign = value < 0 ? '−' : '+'
  return `${sign} $${Math.abs(value).toFixed(2)}`
}

export default function OrdersPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null
  const ordersEnabled = restaurant?.orders_enabled ?? false

  const [orders, setOrders] = useState<OrderRead[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(
    async (id: string, showSpinner: boolean): Promise<void> => {
      if (showSpinner) setLoading(true)
      try {
        const list = await listOrders(id)
        setOrders(list)
        setLoadError(null)
      } catch {
        setLoadError('No se pudieron cargar los pedidos.')
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (restaurantId === null || !ordersEnabled) {
      setLoading(false)
      return
    }
    let active = true

    void refresh(restaurantId, true)
    const interval = window.setInterval(() => {
      if (active) void refresh(restaurantId, false)
    }, POLL_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [restaurantId, ordersEnabled, refresh])

  async function handleTransition(orderId: string, next: OrderStatus): Promise<void> {
    if (restaurantId === null) return
    setBusyId(orderId)
    setActionError(null)
    try {
      const updated = await updateOrderStatus(restaurantId, orderId, next)
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    } catch {
      setActionError('No se pudo actualizar el pedido. Refrescá e intentá de nuevo.')
    } finally {
      setBusyId(null)
    }
  }

  if (restaurantLoading || loading) {
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

  if (!ordersEnabled) {
    return (
      <div className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Pedidos</h1>
        <p className="text-sm text-gray-600">
          La recepción de pedidos está desactivada. Activala desde{' '}
          <Link to="/dashboard" className="font-medium text-gray-900 underline">
            Mi restaurante
          </Link>{' '}
          para empezar a recibir pedidos desde el menú público.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Pedidos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Se actualiza automáticamente cada {POLL_INTERVAL_MS / 1000} segundos.
        </p>
      </div>

      {loadError && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {orders.length === 0 && !loadError && (
        <div className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-sm">
          Todavía no hay pedidos.
        </div>
      )}

      <ul className="space-y-4">
        {orders.map((order) => (
          <li key={order.id} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{order.customer_name}</p>
                <p className="text-xs text-gray-500">
                  {ORDER_TYPE_LABEL[order.order_type]}
                  {order.table_or_address ? ` · ${order.table_or_address}` : ''}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[order.status]}`}
              >
                {STATUS_LABEL[order.status]}
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {order.items.map((line) => (
                <li key={line.id} className="text-sm text-gray-700">
                  <div className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium">{line.quantity}×</span> {line.name_snapshot}
                    </span>
                    <span className="shrink-0 text-gray-900">
                      ${parseFloat(line.subtotal).toFixed(2)}
                    </span>
                  </div>
                  {line.modifiers.length > 0 && (
                    <ul className="mt-0.5 ml-5 list-disc text-xs text-gray-500">
                      {line.modifiers.map((mod) => (
                        <li key={mod.id}>
                          {mod.name_snapshot} ({formatDelta(mod.price_snapshot)})
                        </li>
                      ))}
                    </ul>
                  )}
                  {line.special_instructions && (
                    <p className="ml-5 text-xs italic text-gray-500">
                      {line.special_instructions}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {order.notes && (
              <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                {order.notes}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <span className="text-sm font-semibold text-gray-900">
                Total: ${parseFloat(order.total).toFixed(2)}
              </span>
              <div className="flex flex-wrap gap-2">
                {transitionsFor(order.status).map((transition) => (
                  <button
                    key={transition.next}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => handleTransition(order.id, transition.next)}
                    className={
                      transition.variant === 'primary'
                        ? 'rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60'
                        : 'rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60'
                    }
                  >
                    {transition.label}
                  </button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

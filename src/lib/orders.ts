import { apiGet, apiPatch, apiPost } from './api'
import type { OrderCreatePayload, OrderRead, OrderStatus } from './types'

/**
 * Creates a public order for the given menu (no auth). The backend recalculates
 * the total server-side; the payload's item/modifier ids are references only.
 */
export function createOrder(qrToken: string, payload: OrderCreatePayload): Promise<OrderRead> {
  return apiPost<OrderRead>(`/menu/${qrToken}/orders`, payload)
}

/**
 * Dashboard order queue (authenticated, require_role(editor)). Optionally filter
 * by status; the backend returns the list ordered by created_at descending.
 */
export function listOrders(restaurantId: string, status?: OrderStatus): Promise<OrderRead[]> {
  const query = status ? `?status=${status}` : ''
  return apiGet<OrderRead[]>(`/restaurants/${restaurantId}/orders${query}`)
}

/**
 * Advances an order along the status machine (pending→accepted→ready→completed,
 * or ×→cancelled). The backend returns 409 invalid_transition for illegal moves.
 */
export function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  status: OrderStatus,
): Promise<OrderRead> {
  return apiPatch<OrderRead>(`/restaurants/${restaurantId}/orders/${orderId}`, { status })
}

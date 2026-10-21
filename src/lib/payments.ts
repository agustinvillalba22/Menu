import { apiDelete, apiGet, apiPost } from './api'
import type { MercadoPagoStatus, PublicPaymentStatus } from './types'

/** Dashboard: state of the restaurant's Mercado Pago account (editor+, no tokens). */
export function getMercadoPagoStatus(restaurantId: string): Promise<MercadoPagoStatus> {
  return apiGet<MercadoPagoStatus>(`/restaurants/${restaurantId}/payments/mercadopago`)
}

/**
 * Starts the OAuth connection (owner only). Resolves with the Mercado Pago
 * `authorization_url` the browser must navigate to.
 */
export async function connectMercadoPago(restaurantId: string): Promise<string> {
  const res = await apiPost<{ authorization_url: string }>(
    `/restaurants/${restaurantId}/payments/mercadopago/connect`,
  )
  return res.authorization_url
}

/** Removes the connected account (owner only). Existing orders are untouched. */
export function disconnectMercadoPago(restaurantId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/payments/mercadopago`)
}

/** Public (no auth): payment state of a mercadopago order, for the return screen. */
export function getPublicPaymentStatus(
  qrToken: string,
  orderId: string,
): Promise<PublicPaymentStatus> {
  return apiGet<PublicPaymentStatus>(`/menu/${qrToken}/orders/${orderId}/payment`)
}

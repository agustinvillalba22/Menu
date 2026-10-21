import { apiGet, apiPost } from './api'
import type { PublicBillRequestRead, PublicMenuResponse, PublicOrderStatus } from './types'

export function getPublicMenu(qrToken: string): Promise<PublicMenuResponse> {
  return apiGet<PublicMenuResponse>(`/menu/${qrToken}`)
}

/** Status of the guest's own orders, looked up by their public tokens. */
export function getOrdersStatus(qrToken: string, tokens: string[]): Promise<PublicOrderStatus[]> {
  return apiPost<PublicOrderStatus[]>(`/menu/${qrToken}/orders/status`, { tokens })
}

/** Asks the waiter for the bill using one of the guest's active order tokens. */
export function requestBill(qrToken: string, token: string): Promise<PublicBillRequestRead> {
  return apiPost<PublicBillRequestRead>(`/menu/${qrToken}/orders/bill-request`, { token })
}

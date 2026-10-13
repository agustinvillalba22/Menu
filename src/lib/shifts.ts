import { apiGet, apiPost } from './api'
import type { CashShift, CashShiftClosePayload, CashShiftOpenPayload } from './types'

export function getCurrentShift(restaurantId: string): Promise<CashShift | null> {
  return apiGet<CashShift | null>(`/restaurants/${restaurantId}/shifts/current`)
}

export function listShifts(restaurantId: string, limit = 30, offset = 0): Promise<CashShift[]> {
  return apiGet<CashShift[]>(`/restaurants/${restaurantId}/shifts?limit=${limit}&offset=${offset}`)
}

export function openShift(restaurantId: string, data: CashShiftOpenPayload): Promise<CashShift> {
  return apiPost<CashShift>(`/restaurants/${restaurantId}/shifts`, data)
}

export function closeShift(
  restaurantId: string,
  shiftId: string,
  data: CashShiftClosePayload,
): Promise<CashShift> {
  return apiPost<CashShift>(`/restaurants/${restaurantId}/shifts/${shiftId}/close`, data)
}

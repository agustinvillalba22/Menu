import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { StockItem, StockItemCreatePayload, StockItemUpdatePayload } from './types'

export function listStockItems(restaurantId: string): Promise<StockItem[]> {
  return apiGet<StockItem[]>(`/restaurants/${restaurantId}/stock-items`)
}

export function createStockItem(
  restaurantId: string,
  data: StockItemCreatePayload,
): Promise<StockItem> {
  return apiPost<StockItem>(`/restaurants/${restaurantId}/stock-items`, data)
}

export function updateStockItem(
  restaurantId: string,
  stockItemId: string,
  data: StockItemUpdatePayload,
): Promise<StockItem> {
  return apiPatch<StockItem>(`/restaurants/${restaurantId}/stock-items/${stockItemId}`, data)
}

export function deleteStockItem(restaurantId: string, stockItemId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/stock-items/${stockItemId}`)
}

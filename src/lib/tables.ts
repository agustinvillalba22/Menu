import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { Table, TableCreatePayload, TableUpdatePayload } from './types'

export function listTables(restaurantId: string): Promise<Table[]> {
  return apiGet<Table[]>(`/restaurants/${restaurantId}/tables`)
}

export function createTable(restaurantId: string, data: TableCreatePayload): Promise<Table> {
  return apiPost<Table>(`/restaurants/${restaurantId}/tables`, data)
}

export function updateTable(
  restaurantId: string,
  tableId: string,
  data: TableUpdatePayload,
): Promise<Table> {
  return apiPatch<Table>(`/restaurants/${restaurantId}/tables/${tableId}`, data)
}

export function deleteTable(restaurantId: string, tableId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/tables/${tableId}`)
}

import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { Table, TableCreatePayload, TableOccupancy, TableUpdatePayload } from './types'

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

// Plano operativo
export function getTablesOccupancy(restaurantId: string): Promise<TableOccupancy[]> {
  return apiGet<TableOccupancy[]>(`/restaurants/${restaurantId}/tables/occupancy`)
}

export function requestBill(restaurantId: string, tableId: string): Promise<TableOccupancy> {
  return apiPost<TableOccupancy>(`/restaurants/${restaurantId}/tables/${tableId}/bill-request`, {})
}

export function checkoutTable(
  restaurantId: string,
  tableId: string,
  staffMemberId?: string,
): Promise<TableOccupancy> {
  return apiPost<TableOccupancy>(
    `/restaurants/${restaurantId}/tables/${tableId}/checkout`,
    staffMemberId ? { staff_member_id: staffMemberId } : {},
  )
}

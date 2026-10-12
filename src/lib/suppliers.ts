import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { Supplier, SupplierCreatePayload, SupplierUpdatePayload } from './types'

export function listSuppliers(restaurantId: string): Promise<Supplier[]> {
  return apiGet<Supplier[]>(`/restaurants/${restaurantId}/suppliers`)
}

export function createSupplier(
  restaurantId: string,
  data: SupplierCreatePayload,
): Promise<Supplier> {
  return apiPost<Supplier>(`/restaurants/${restaurantId}/suppliers`, data)
}

export function updateSupplier(
  restaurantId: string,
  supplierId: string,
  data: SupplierUpdatePayload,
): Promise<Supplier> {
  return apiPatch<Supplier>(`/restaurants/${restaurantId}/suppliers/${supplierId}`, data)
}

export function deleteSupplier(restaurantId: string, supplierId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/suppliers/${supplierId}`)
}

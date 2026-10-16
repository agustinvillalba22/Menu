import { apiGet, apiPatch } from './api'
import type { AdminUser, AdminRestaurant, Menu } from './types'

export function listAdminUsers(): Promise<AdminUser[]> {
  return apiGet<AdminUser[]>('/admin/users')
}

export function updateAdminUser(
  userId: string,
  patch: Partial<Pick<AdminUser, 'is_active' | 'is_superadmin'>>,
): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/admin/users/${userId}`, patch)
}

export function listAdminRestaurants(): Promise<AdminRestaurant[]> {
  return apiGet<AdminRestaurant[]>('/admin/restaurants')
}

export function updateAdminRestaurant(
  restaurantId: string,
  patch: { is_active: boolean },
): Promise<AdminRestaurant> {
  return apiPatch<AdminRestaurant>(`/admin/restaurants/${restaurantId}`, patch)
}

export function listAdminRestaurantMenus(restaurantId: string): Promise<Menu[]> {
  return apiGet<Menu[]>(`/admin/restaurants/${restaurantId}/menus`)
}

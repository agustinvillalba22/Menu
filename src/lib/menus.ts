import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Category, CategoryCreate, Menu, MenuCreate, MenuUpdate } from './types'

// Menus. Categories-by-menu use the v2 routes; the legacy
// `/restaurants/{id}/categories` routes keep targeting the default menu.

export function listMenus(restaurantId: string): Promise<Menu[]> {
  return apiGet<Menu[]>(`/restaurants/${restaurantId}/menus`)
}

export function createMenu(restaurantId: string, data: MenuCreate): Promise<Menu> {
  return apiPost<Menu>(`/restaurants/${restaurantId}/menus`, data)
}

export function updateMenu(restaurantId: string, menuId: string, data: MenuUpdate): Promise<Menu> {
  return apiPatch<Menu>(`/restaurants/${restaurantId}/menus/${menuId}`, data)
}

export function deleteMenu(restaurantId: string, menuId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/menus/${menuId}`)
}

export function listCategoriesForMenu(restaurantId: string, menuId: string): Promise<Category[]> {
  return apiGet<Category[]>(`/restaurants/${restaurantId}/menus/${menuId}/categories`)
}

export function createCategoryForMenu(
  restaurantId: string,
  menuId: string,
  data: CategoryCreate,
): Promise<Category> {
  return apiPost<Category>(`/restaurants/${restaurantId}/menus/${menuId}/categories`, data)
}


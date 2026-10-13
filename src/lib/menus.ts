import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Category, CategoryCreate, CategoryUpdate, Menu, MenuCreate, MenuUpdate, Subcategory } from './types'

// Menus (M21). Categories-by-menu use the v2 routes; the legacy
// `/restaurants/{id}/categories` routes keep targeting the default menu.

export interface CategoryTree extends Category {
  subcategories: Subcategory[]
}

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

export function getMenuTree(restaurantId: string, menuId: string): Promise<CategoryTree[]> {
  return apiGet<CategoryTree[]>(`/restaurants/${restaurantId}/menus/${menuId}/tree`)
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

export function updateCategoryForMenu(
  restaurantId: string,
  menuId: string,
  categoryId: string,
  data: CategoryUpdate,
): Promise<Category> {
  return apiPatch<Category>(
    `/restaurants/${restaurantId}/menus/${menuId}/categories/${categoryId}`,
    data,
  )
}

export function deleteCategoryForMenu(
  restaurantId: string,
  menuId: string,
  categoryId: string,
): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/menus/${menuId}/categories/${categoryId}`)
}

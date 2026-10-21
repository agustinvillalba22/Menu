import { apiGet, apiPatch, apiPost } from './api'
import type { Restaurant, RestaurantCreate, RestaurantUpdate } from './types'

export function listRestaurants(): Promise<Restaurant[]> {
  return apiGet<Restaurant[]>('/restaurants')
}

export function createRestaurant(data: RestaurantCreate): Promise<Restaurant> {
  return apiPost<Restaurant>('/restaurants', data)
}

export function updateRestaurant(id: string, data: RestaurantUpdate): Promise<Restaurant> {
  return apiPatch<Restaurant>(`/restaurants/${id}`, data)
}

/** M15 RF-03/RNF-05 — single source of truth for "can this user edit
 * owner-only restaurant settings". Mirrors the backend's
 * `require_role(RestaurantRole.owner)` split (restaurant/style/business_hours
 * mutations and logo upload), so every page gates the same way. */
export function isOwner(restaurant: Restaurant | null): boolean {
  return restaurant?.role === 'owner'
}

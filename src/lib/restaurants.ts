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

export function getRestaurant(id: string): Promise<Restaurant> {
  return apiGet<Restaurant>(`/restaurants/${id}`)
}

import { apiGet, apiPost } from './api'
import type { Restaurant, RestaurantCreate } from './types'

export function listRestaurants(): Promise<Restaurant[]> {
  return apiGet<Restaurant[]>('/restaurants')
}

export function createRestaurant(data: RestaurantCreate): Promise<Restaurant> {
  return apiPost<Restaurant>('/restaurants', data)
}

export function getRestaurant(id: string): Promise<Restaurant> {
  return apiGet<Restaurant>(`/restaurants/${id}`)
}

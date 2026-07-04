import { apiGet, apiPatch } from './api'
import type { Style, StyleUpdate } from './types'

export function getStyle(restaurantId: string): Promise<Style> {
  return apiGet<Style>(`/restaurants/${restaurantId}/style`)
}

export function updateStyle(restaurantId: string, data: StyleUpdate): Promise<Style> {
  return apiPatch<Style>(`/restaurants/${restaurantId}/style`, data)
}

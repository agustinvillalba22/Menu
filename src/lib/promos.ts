import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type {
  Promo,
  PromoCreate,
  PromoImageUploadRequest,
  PromoImageUploadResponse,
  PromoUpdate,
} from './types'

// --- Promo CRUD ----------------------------------------------
// Mirrors lib/restaurantInfo.ts: thin typed wrappers so the dashboard page
// never has to know about URL shapes.

export function listPromos(restaurantId: string): Promise<Promo[]> {
  return apiGet<Promo[]>(`/restaurants/${restaurantId}/promos`)
}

export function createPromo(restaurantId: string, data: PromoCreate): Promise<Promo> {
  return apiPost<Promo>(`/restaurants/${restaurantId}/promos`, data)
}

export function updatePromo(
  restaurantId: string,
  promoId: string,
  data: PromoUpdate,
): Promise<Promo> {
  return apiPatch<Promo>(`/restaurants/${restaurantId}/promos/${promoId}`, data)
}

export function deletePromo(restaurantId: string, promoId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/promos/${promoId}`)
}

// --- Promo image (R2 presigned flow, same as items/logos) -------------------

export function getPromoImageUploadUrl(
  restaurantId: string,
  promoId: string,
  data: PromoImageUploadRequest,
): Promise<PromoImageUploadResponse> {
  return apiPost<PromoImageUploadResponse>(
    `/restaurants/${restaurantId}/promos/${promoId}/image/upload-url`,
    data,
  )
}

export function confirmPromoImage(
  restaurantId: string,
  promoId: string,
  objectKey: string,
): Promise<Promo> {
  return apiPost<Promo>(`/restaurants/${restaurantId}/promos/${promoId}/image/confirm`, {
    object_key: objectKey,
  })
}

export function deletePromoImage(
  restaurantId: string,
  promoId: string,
): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/promos/${promoId}/image`)
}

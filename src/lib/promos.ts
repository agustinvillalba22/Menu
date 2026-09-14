import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type {
  Promo,
  PromoCreate,
  PromoImageUploadRequest,
  PromoImageUploadResponse,
  PromoUpdate,
} from './types'

// --- Promo CRUD (P4, Fase 2c) ----------------------------------------------
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

/**
 * PUTs the raw image straight to the presigned R2 URL — deliberately not
 * through apiFetch (no VITE_API_URL prefix, no JSON content-type, no
 * credentials to the third-party origin). Same as the logo/item helpers.
 */
export async function uploadPromoImageToR2(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) {
    throw new Error(`R2 promo image upload failed with status ${res.status}`)
  }
}

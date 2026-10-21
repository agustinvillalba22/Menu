import { apiGet, apiPatch, apiPut, apiPost, apiDelete } from './api'
import type {
  BusinessHours,
  BusinessHoursUpsert,
  RestaurantInfo,
  RestaurantInfoUpdate,
  LogoUploadRequest,
  LogoUploadResponse,
} from './types'

// --- Restaurant info ------------------------------------------------

export function getRestaurantInfo(restaurantId: string): Promise<RestaurantInfo> {
  return apiGet<RestaurantInfo>(`/restaurants/${restaurantId}/info`)
}

export function updateRestaurantInfo(
  restaurantId: string,
  data: RestaurantInfoUpdate,
): Promise<RestaurantInfo> {
  return apiPatch<RestaurantInfo>(`/restaurants/${restaurantId}/info`, data)
}

// --- Business hours -------------------------------------------------

/** Atomically replaces the whole week's schedule. `hours` is the full set. */
export function replaceBusinessHours(
  restaurantId: string,
  hours: BusinessHoursUpsert[],
): Promise<BusinessHours[]> {
  return apiPut<BusinessHours[]>(`/restaurants/${restaurantId}/business-hours`, { hours })
}

// --- Restaurant logo ------------------------------------------------
// Same presigned-PUT + confirm + delete flow as the item-image endpoints,
// wrapped so the dashboard page doesn't have to know about R2 object keys.

export function getLogoUploadUrl(
  restaurantId: string,
  data: LogoUploadRequest,
): Promise<LogoUploadResponse> {
  return apiPost<LogoUploadResponse>(
    `/restaurants/${restaurantId}/logo/upload-url`,
    data,
  )
}

export function confirmLogoUpload(restaurantId: string, objectKey: string): Promise<unknown> {
  // The backend returns the full RestaurantRead, but the info page only needs
  // to re-fetch /info afterwards — the typed return is left loose to avoid
  // importing RestaurantRead just for the side effect.
  return apiPost<unknown>(`/restaurants/${restaurantId}/logo/confirm`, {
    object_key: objectKey,
  })
}

export function deleteRestaurantLogo(restaurantId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/logo`)
}

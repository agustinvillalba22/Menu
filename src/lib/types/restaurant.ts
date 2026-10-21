export type RestaurantRole = 'owner' | 'editor'

export interface Restaurant {
  id: string
  name: string
  slug: string
  qr_token: string
  orders_enabled: boolean
  role: RestaurantRole
}

export interface RestaurantCreate {
  name: string
}

export interface RestaurantUpdate {
  name: string
  orders_enabled?: boolean
}

export type FontFamily = 'Inter' | 'Playfair Display' | 'Poppins' | 'DM Sans'

export interface Style {
  font_family: FontFamily
  primary_color: string | null
  secondary_color: string | null
}

export interface StyleUpdate {
  font_family?: FontFamily
  primary_color?: string | null
  secondary_color?: string | null
}

// --- Restaurant info + business hours + logo ----------------

/** One day's open/close window, as read by the dashboard info page. */
export interface BusinessHours {
  id?: string
  weekday: number
  open_time: string
  close_time: string
}

/** Body for PUT /restaurants/{id}/business-hours — one row's upsert payload. */
export interface BusinessHoursUpsert {
  weekday: number
  open_time: string
  close_time: string
}

export interface RestaurantInfo {
  address: string
  phone: string
  whatsapp_phone: string | null
  whatsapp_enabled: boolean
  logo_url: string | null
  timezone: string
  business_hours: BusinessHours[]
  is_open_now: boolean
}

/** Partial PATCH for the contact-info columns.
 *
 * Mirrors the backend `RestaurantInfoUpdate`: an omitted field is left
 * untouched; an explicit null clears the nullable phone/logo; an empty
 * string clears `whatsapp_phone` (the dashboard never sends `null` on a
 * typed `<input type="tel">`).
 */
export interface RestaurantInfoUpdate {
  address?: string
  phone?: string
  whatsapp_phone?: string | null
  timezone?: string
  // logo_url is normally managed by the R2 upload endpoints, but kept type-
  // open so the dashboard never has to special-case a PATCH.
  logo_url?: string | null
}

export interface LogoUploadRequest {
  content_type: string
  file_size: number
}

export interface LogoUploadResponse {
  upload_url: string
  object_key: string
  expires_in: number
}

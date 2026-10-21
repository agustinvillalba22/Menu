// --- Promos ---------------------------------------------

/** What the promo's discount applies to — mirrors PromoScope. */
export type PromoScope = 'none' | 'item' | 'category' | 'catalog'

/** What the public menu renders — never the scheduling internals. */
export interface PublicPromo {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  discount_pct: number | null
  image_url: string | null
  // Lets the cart mirror the server's discount rule.
  scope: PromoScope
  item_id: string | null
  category_id: string | null
}

/** Dashboard read shape — includes the server-computed expiry signal. */
export interface Promo {
  id: string
  restaurant_id: string
  title: string
  subtitle: string | null
  description: string | null
  discount_pct: number | null
  image_url: string | null
  scope: PromoScope
  item_id: string | null
  category_id: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  // Calendar days until ends_at in the restaurant's tz (server-side), null
  // when the promo has no end date. 0 = expires today or already past.
  days_remaining: number | null
}

export interface PromoCreate {
  title: string
  subtitle?: string | null
  description?: string | null
  discount_pct?: number | null
  image_url?: string | null
  scope?: PromoScope
  item_id?: string | null
  category_id?: string | null
  is_active?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

/** Partial PATCH — only the fields actually present are applied. */
export interface PromoUpdate {
  title?: string
  subtitle?: string | null
  description?: string | null
  discount_pct?: number | null
  image_url?: string | null
  scope?: PromoScope
  item_id?: string | null
  category_id?: string | null
  is_active?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export interface PromoImageUploadRequest {
  content_type: string
  file_size: number
}

export interface PromoImageUploadResponse {
  upload_url: string
  object_key: string
  expires_in: number
}

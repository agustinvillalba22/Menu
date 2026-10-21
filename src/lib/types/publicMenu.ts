import type { Style } from './restaurant'
import type { PublicCategory } from './menu'
import type { PublicPromo } from './promo'
import type { Table } from './table'

export interface PublicBusinessHours {
  weekday: number
  open_time: string
  close_time: string
}

export interface PublicRestaurant {
  name: string
  slug: string
  // Drives the ordering UI (cart/checkout) on the public menu. The server also
  // enforces it on POST /menu/{qr_token}/orders (404 orders_disabled).
  orders_enabled: boolean
  // Local info shown in the public header (logo, address, phone,
  // schedule summary + Abierto/Cerrado pill). Strings are '' when unset so
  // the header can use `if (address)` consistently with the rest of the code.
  address: string
  phone: string
  logo_url: string | null
  timezone: string
  business_hours: PublicBusinessHours[]
  is_open_now: boolean
  // Lets the checkout render the "Confirmar por WhatsApp" button
  // without a second round trip. Boolean only: the raw phone never leaves the
  // server (the deep link URL is minted server-side in POST /orders).
  // True only with a connected Mercado Pago account + server configured.
  accepts_mercadopago?: boolean
}

export interface PublicMenuResponse {
  restaurant: PublicRestaurant
  style: Style | null
  // The currently-active promo banner, resolved server-side against
  // is_active + the validity window in the restaurant's tz. Null = none.
  promo: PublicPromo | null
  // The restaurant's configured tables (empty if none set up yet).
  tables: Table[]
  categories: PublicCategory[]
  // Also accepted at the top level of the response (see PublicMenuPage).
  accepts_mercadopago?: boolean
}

export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_superadmin: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  full_name: string
}

export interface ValidationErrorItem {
  loc: (string | number)[]
  msg: string
  type: string
}

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

export interface PublicTag {
  id: string
  name: string
}

// --- Modificadores (M11) ---------------------------------------------------

export type ModifierType = 'extra' | 'removal'

export interface PublicModifier {
  id: string
  name: string
  price_delta: string // Decimal serializado, puede tener signo "-"
  type: ModifierType
}

export interface PublicItem {
  id: string
  name: string
  description: string
  price: string
  image_url: string | null // NUEVO (M11)
  tags: PublicTag[]
  modifiers: PublicModifier[] // NUEVO (M11)
}

export interface PublicSubcategory {
  id: string
  name: string
  items: PublicItem[]
}

export type CategoryType = 'food' | 'drink'

/**
 * Curated category icon keys (P8). Mirror of the backend `CategoryIcon`
 * enum — the dashboard picker only offers these values, and the public menu
 * chip renders a Lucide component for each (see `lib/categoryIcons.ts`).
 * `null` means "text-only chip" — no icon component rendered.
 */
export type CategoryIcon =
  | 'utensils'
  | 'glass_water'
  | 'pizza'
  | 'beer'
  | 'wine'
  | 'cake'
  | 'coffee'
  | 'ice_cream'
  | 'salad'
  | 'soup'
  | 'fish'
  | 'beef'
  | 'chicken'
  | 'bread'
  | 'cookies'
  | 'croissant'
  | 'flame'
  | 'sparkles'
  | 'chef_hat'
  | 'cup_soda'
  | 'more_horizontal'
  | 'clipboard_list'

export interface PublicCategory {
  id: string
  name: string
  type: CategoryType
  icon: CategoryIcon | null
  subcategories: PublicSubcategory[]
}

// --- Dashboard CRUD (M9) ---------------------------------------------------
// Read types use bare names (`Category`, not `CategoryRead`), matching the
// convention already used for the authenticated side (`Restaurant`). The
// `Public*` types above are for the public endpoint and are not reused here.

export interface CategoryCreate {
  name: string
  type: CategoryType
  icon?: CategoryIcon | null
}

export interface CategoryUpdate {
  name?: string
  type?: CategoryType
  icon?: CategoryIcon | null
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  icon: CategoryIcon | null
}

export interface SubcategoryCreate {
  name: string
}

export interface SubcategoryUpdate {
  name: string // the backend does NOT make this optional for subcategories
}

export interface Subcategory {
  id: string
  name: string
  category_id: string
}

export interface Tag {
  id: string
  name: string
}

export interface TagCreate {
  name: string
}

// --- Modificadores por ítem (dashboard CRUD, M11) --------------------------
// Authenticated read type (mirrors backend ItemModifierRead). Distinct from
// `PublicModifier` above (which the public menu uses) because this one carries
// `item_id`. `price_delta` stays a string, may be negative for removals.

export interface Modifier {
  id: string
  item_id: string
  name: string
  price_delta: string
  type: ModifierType
}

export interface ModifierCreate {
  name: string
  price_delta: string
  type: ModifierType
}

export interface ModifierUpdate {
  name?: string
  price_delta?: string
  type?: ModifierType
}

export interface ItemCreate {
  name: string
  description?: string // defaults to '' if omitted
  price: string
}

export interface ItemUpdate {
  name?: string
  description?: string
  price?: string
}

export interface Item {
  id: string
  name: string
  description: string
  price: string
  image_url: string | null
  subcategory_id: string
  tags: Tag[]
}

// --- Item image upload (M10) -----------------------------------------------

export interface ItemImageUploadRequest {
  content_type: string
  file_size: number
}

export interface ItemImageUploadResponse {
  upload_url: string
  object_key: string
  expires_in: number
}

export interface ImportRowError {
  row: number
  reason: string
  detail: string | null
}

export interface ImportResult {
  imported: number
  errors: ImportRowError[]
}

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
  // P6 — local info shown in the public header (logo, address, phone,
  // schedule summary + Abierto/Cerrado pill). Strings are '' when unset so
  // the header can use `if (address)` consistently with the rest of the code.
  address: string
  phone: string
  logo_url: string | null
  timezone: string
  business_hours: PublicBusinessHours[]
  is_open_now: boolean
  // P7 — lets the checkout render the "Confirmar por WhatsApp" button
  // without a second round trip. Boolean only: the raw phone never leaves the
  // server (the deep link URL is minted server-side in POST /orders).
  whatsapp_enabled: boolean
}

export interface PublicMenuResponse {
  restaurant: PublicRestaurant
  style: Style | null
  categories: PublicCategory[]
}

// --- Restaurant info + business hours + logo (P6, Fase 1d) ----------------

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

// --- Pedidos (M11) ---------------------------------------------------------

export type OrderType = 'mesa' | 'llevar' | 'envio'
export type OrderStatus = 'pending' | 'accepted' | 'ready' | 'completed' | 'cancelled'

export interface OrderItemCreate {
  item_id: string
  quantity: number
  modifier_ids: string[]
  special_instructions?: string | null
}

export interface OrderCreatePayload {
  customer_name: string
  order_type: OrderType
  table_or_address?: string | null
  notes?: string | null
  items: OrderItemCreate[]
}

export interface OrderItemModifierRead {
  id: string
  name_snapshot: string
  price_snapshot: string
  type: ModifierType
}

export interface OrderItemRead {
  id: string
  item_id: string | null
  name_snapshot: string
  unit_price_snapshot: string
  quantity: number
  special_instructions: string | null
  subtotal: string
  modifiers: OrderItemModifierRead[]
}

export interface OrderRead {
  id: string
  restaurant_id: string
  status: OrderStatus
  customer_name: string
  order_type: OrderType
  table_or_address: string | null
  notes: string | null
  total: string
  created_at: string
  updated_at: string
  items: OrderItemRead[]
  // P7: server-minted wa.me deep link built off the order's snapshots and
  // the restaurant's whatsapp_phone. Only set on the POST /menu/{qr}/orders
  // response. Null when the restaurant has no whatsapp phone OR when the read
  // comes from the dashboard side (list/patch), where the URL is irrelevant.
  // The checkout's "Confirmar por WhatsApp" button uses this verbatim.
  whatsapp_url: string | null
}

// --- Panel de administración (M13.2) ---------------------------------------

export interface AdminUser {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_superadmin: boolean
  created_at: string
}

export interface AdminRestaurant {
  id: string
  name: string
  slug: string
  qr_token: string
  is_active: boolean
  orders_enabled: boolean
  owner_email: string | null
}

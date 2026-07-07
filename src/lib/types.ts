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

export interface PublicCategory {
  id: string
  name: string
  type: CategoryType
  subcategories: PublicSubcategory[]
}

// --- Dashboard CRUD (M9) ---------------------------------------------------
// Read types use bare names (`Category`, not `CategoryRead`), matching the
// convention already used for the authenticated side (`Restaurant`). The
// `Public*` types above are for the public endpoint and are not reused here.

export interface CategoryCreate {
  name: string
  type: CategoryType
}

export interface CategoryUpdate {
  name?: string
  type?: CategoryType
}

export interface Category {
  id: string
  name: string
  type: CategoryType
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

export interface ImportRowError {
  row: number
  reason: string
  detail: string | null
}

export interface ImportResult {
  imported: number
  errors: ImportRowError[]
}

export interface PublicRestaurant {
  name: string
  slug: string
  // Drives the ordering UI (cart/checkout) on the public menu. The server also
  // enforces it on POST /menu/{qr_token}/orders (404 orders_disabled).
  orders_enabled: boolean
}

export interface PublicMenuResponse {
  restaurant: PublicRestaurant
  style: Style | null
  categories: PublicCategory[]
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
}

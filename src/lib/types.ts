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

// --- Modificadores ---------------------------------------------------

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
  image_url: string | null // NUEVO
  // Owning category, so the cart can evaluate category-scoped
  // promo discounts without a second round trip.
  category_id: string
  tags: PublicTag[]
  modifiers: PublicModifier[] // NUEVO
}

export interface PublicSubcategory {
  id: string
  name: string
  items: PublicItem[]
}

export type CategoryType = 'food' | 'drink'

/**
 * Curated category icon keys. Mirror of the backend `CategoryIcon`
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

// --- Dashboard CRUD ---------------------------------------------------
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

// --- Modificadores por ítem (dashboard CRUD) --------------------------
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

// --- Item image upload -----------------------------------------------

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
  whatsapp_enabled: boolean
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

// --- Mesas -------------------------------------------------------------

export interface Table {
  id: string
  number: number
  capacity: number | null
  bill_requested_at?: string | null
}

// Estado operativo de una mesa (GET /tables/occupancy).
export type TableStatus = 'free' | 'occupied' | 'bill'

export interface TableOccupancy {
  id: string
  number: number
  capacity: number | null
  status: TableStatus
  total: string
  first_order_at: string | null
  bill_requested_at: string | null
  orders: OrderRead[]
}

export interface TableCreatePayload {
  number: number
  capacity?: number | null
}

export interface TableUpdatePayload {
  number?: number
  capacity?: number | null
}

// --- Staff -------------------------------------------------------------
// Identification-only roster — no relation to auth, no permissions gated by
// `position`.

export type StaffPosition = 'mozo' | 'bartender' | 'jefe_cocina' | 'cajero' | 'gerente'

export interface StaffMember {
  id: string
  name: string
  position: StaffPosition
  pin: string
  active: boolean
}

export interface StaffMemberCreatePayload {
  name: string
  position: StaffPosition
  pin: string
}

export interface StaffMemberUpdatePayload {
  name?: string
  position?: StaffPosition
  pin?: string
  active?: boolean
}

// --- Stock + Proveedores ----------------------------------------------
// Manually-managed inventory — no link to menu Items/Orders, no
// auto-decrement.

export interface Supplier {
  id: string
  name: string
  category: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  delivery_days: string | null
  payment_terms: string | null
  notes: string | null
  active: boolean
}

export interface SupplierCreatePayload {
  name: string
  category?: string | null
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  delivery_days?: string | null
  payment_terms?: string | null
  notes?: string | null
}

export type SupplierUpdatePayload = Partial<SupplierCreatePayload> & { active?: boolean }

export type StockCategory =
  | 'carnes_pescados'
  | 'verduras_frescos'
  | 'almacen_secos'
  | 'lacteos'
  | 'bebidas_licores'

export type StockUnit = 'kg' | 'g' | 'l' | 'unidades' | 'botellas'

export interface StockItem {
  id: string
  name: string
  category: StockCategory
  unit: StockUnit
  quantity: string // Decimal as string, same convention as price
  min_threshold: string
  cost_per_unit: string | null
  supplier_id: string | null
  last_restocked: string | null // YYYY-MM-DD
}

export interface StockItemCreatePayload {
  name: string
  category: StockCategory
  unit: StockUnit
  quantity?: string
  min_threshold?: string
  cost_per_unit?: string | null
  supplier_id?: string | null
  last_restocked?: string | null
}

export type StockItemUpdatePayload = Partial<StockItemCreatePayload>

// --- Pedidos ---------------------------------------------------------

export type OrderType = 'mesa' | 'llevar' | 'envio'
export type OrderStatus = 'pending' | 'accepted' | 'ready' | 'completed' | 'cancelled'

// --- Pagos con Mercado Pago -------------------------------------------

export type PaymentMethod = 'cash' | 'mercadopago'
export type PaymentStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'cancelled'

/** Dashboard view of the restaurant's Mercado Pago account — never carries tokens. */
export interface MercadoPagoStatus {
  configured: boolean
  connected: boolean
  status: 'connected' | 'disconnected' | null
  mp_user_id: string | null
}

/** Public polling response for the post-payment return screen. */
export interface PublicPaymentStatus {
  payment_status: PaymentStatus
  status: OrderStatus
}

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
  // When order_type is 'mesa' and the restaurant has real tables
  // configured, the client sends the picked table's id instead of free text.
  table_id?: string | null
  notes?: string | null
  // Omitted for cash (server default); 'mercadopago' only when the menu
  // reports `accepts_mercadopago`.
  payment_method?: PaymentMethod
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
  // Promo discount applied to the line (null = none). Explains
  // why subtotal < unit_price_snapshot * quantity in the registry.
  discount_pct: number | null
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
  table_id: string | null
  notes: string | null
  total: string
  created_at: string
  updated_at: string
  items: OrderItemRead[]
  // Server-minted wa.me deep link built off the order's snapshots and
  // the restaurant's whatsapp_phone. Only set on the POST /menu/{qr}/orders
  // response. Null when the restaurant has no whatsapp phone OR when the read
  // comes from the dashboard side (list/patch), where the URL is irrelevant.
  // The checkout's "Confirmar por WhatsApp" button uses this verbatim.
  whatsapp_url: string | null
  // Who handled the order (snapshot name survives staff deletion) and
  // the cash shift it was completed in.
  handled_by_id: string | null
  handled_by_name: string | null
  cash_shift_id: string | null
  // How the order is paid. `payment_url` is the Checkout Pro `init_point`,
  // only set on the POST /menu/{qr}/orders response for mercadopago orders.
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  payment_url: string | null
  // Per-order guest credential, only set on the public POST response.
  public_token?: string | null
}

// "Tu consumo" — anonymous, token-based view of the guest's own orders.
export interface PublicOrderStatus {
  token: string
  status: OrderStatus
  created_at: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  total: string
  table_number: number | null
  bill_requested: boolean
  items: { name: string; quantity: number; subtotal: string; modifiers: string[] }[]
}

export interface PublicBillRequestRead {
  bill_requested: true
  bill_requested_at: string
}

// --- Panel de administración ---------------------------------------

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

// --- Turnos de caja ---------------------------------------------------
// Amounts are decimal strings, never floats.

export interface CashShift {
  id: string
  opened_by_name: string
  opened_at: string
  opening_amount: string
  closed_by_name: string | null
  closed_at: string | null
  counted_amount: string | null
  expected_amount: string | null
  difference: string | null
  notes: string | null
  orders_count: number
}

export interface CashShiftOpenPayload {
  staff_member_id: string
  opening_amount: string
  notes?: string | null
}

export interface CashShiftClosePayload {
  staff_member_id: string
  counted_amount: string
  notes?: string | null
}

// --- Multiple menus --------------------------------------------------

export interface Menu {
  id: string
  name: string
  is_default: boolean
  start_time: string | null // "HH:MM:SS"
  end_time: string | null
  weekday_mask: number | null // bit i = day i (0=Mon..6=Sun); null = every day
  categories_count: number
}

export interface MenuCreate {
  name: string
  is_default?: boolean
  start_time?: string | null
  end_time?: string | null
  weekday_mask?: number | null
}

export interface MenuUpdate {
  name?: string
  is_default?: boolean
  start_time?: string | null
  end_time?: string | null
  weekday_mask?: number | null
}

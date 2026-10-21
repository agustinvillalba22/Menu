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

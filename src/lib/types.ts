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
  role: RestaurantRole
}

export interface RestaurantCreate {
  name: string
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

export interface PublicItem {
  id: string
  name: string
  description: string
  price: string
  tags: PublicTag[]
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
}

export interface PublicMenuResponse {
  restaurant: PublicRestaurant
  style: Style | null
  categories: PublicCategory[]
}

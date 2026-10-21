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

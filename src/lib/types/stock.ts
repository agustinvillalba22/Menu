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

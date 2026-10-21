import type { ModifierType } from './menu'

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

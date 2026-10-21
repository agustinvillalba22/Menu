import type { CashShift, OrderRead, Restaurant, StockItem } from '../../lib/types'

export const restaurantFixture: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: true,
  role: 'owner',
}

export function stockFixture(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: 'i1',
    name: 'Harina',
    category: 'almacen_secos',
    unit: 'kg',
    quantity: '10.00',
    min_threshold: '2.00',
    cost_per_unit: null,
    supplier_id: null,
    last_restocked: null,
    ...overrides,
  }
}

export function orderFixture(overrides: Partial<OrderRead> = {}): OrderRead {
  return {
    id: 'o1',
    restaurant_id: 'r1',
    status: 'pending',
    customer_name: 'Ana',
    order_type: 'dine_in',
    table_or_address: null,
    table_id: null,
    notes: null,
    total: '10.00',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    items: [],
    whatsapp_url: null,
    handled_by_id: null,
    handled_by_name: null,
    ...overrides,
  } as OrderRead
}

export function shiftFixture(overrides: Partial<CashShift> = {}): CashShift {
  return {
    id: 's1',
    opened_by_name: 'Ana',
    opened_at: new Date(2026, 0, 1, 18, 30).toISOString(),
    opening_amount: '100.00',
    closed_by_name: null,
    closed_at: null,
    counted_amount: null,
    expected_amount: null,
    difference: null,
    notes: null,
    orders_count: 0,
    ...overrides,
  }
}

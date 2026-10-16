import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OrdersPage from '../../pages/dashboard/OrdersPage'
import type { OrderItemRead, OrderRead, Restaurant } from '../../lib/types'
import { jsonResponse, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const restaurantEnabled: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: true,
  role: 'owner',
}

const plainLine: OrderItemRead = {
  id: 'oi1',
  item_id: 'i1',
  name_snapshot: 'Margherita',
  unit_price_snapshot: '11.50',
  discount_pct: null,
  quantity: 2,
  special_instructions: null,
  subtotal: '23.00',
  modifiers: [],
}

const discountedLine: OrderItemRead = {
  id: 'oi2',
  item_id: 'i2',
  name_snapshot: 'Calzone',
  unit_price_snapshot: '11.50',
  discount_pct: 20,
  quantity: 2,
  special_instructions: null,
  subtotal: '18.40',
  modifiers: [],
}

function orderWith(items: OrderItemRead[]): OrderRead {
  return {
    id: 'o1',
    restaurant_id: 'r1',
    status: 'pending',
    customer_name: 'Juan Pérez',
    order_type: 'mesa',
    table_or_address: 'Mesa 4',
    table_id: null,
    notes: null,
    total: '23.00',
    created_at: '2026-07-07T10:00:00Z',
    updated_at: '2026-07-07T10:00:00Z',
    whatsapp_url: null,
    handled_by_id: null,
    handled_by_name: null,
    cash_shift_id: null,
    items,
  }
}

async function renderWith(items: OrderItemRead[]) {
  routeFetch([
    { method: 'GET', match: '/orders', response: jsonResponse([orderWith(items)]) },
    { method: 'GET', match: '/restaurants', response: jsonResponse([restaurantEnabled]) },
  ])
  render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>,
  )
  await screen.findByText('Juan Pérez')
}

describe('OrdersPage discount badge', () => {
  it('shows the -X% badge and struck-through list price for a discounted line', async () => {
    await renderWith([discountedLine])

    expect(screen.getByText('-20%')).toBeInTheDocument()
    expect(screen.getByLabelText('Descuento del 20%')).toBeInTheDocument()
    const struck = screen.getByText('$23.00')
    expect(struck).toHaveClass('line-through')
    expect(screen.getByText('$18.40')).toBeInTheDocument()
  })

  it('shows no badge nor struck price when discount_pct is null', async () => {
    await renderWith([plainLine])

    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Descuento del/)).not.toBeInTheDocument()
    expect(screen.getByText('$23.00')).not.toHaveClass('line-through')
  })

  it('shows no badge nor struck price when discount_pct is 0', async () => {
    await renderWith([{ ...plainLine, discount_pct: 0 }])

    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Descuento del/)).not.toBeInTheDocument()
    expect(screen.getByText('$23.00')).not.toHaveClass('line-through')
  })

  it('only the discounted line gets a badge in a mixed order', async () => {
    await renderWith([plainLine, discountedLine])

    expect(screen.getAllByLabelText(/Descuento del/)).toHaveLength(1)
    expect(screen.getAllByText(/^-\d+%$/)).toHaveLength(1)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OrdersPage from '../../pages/dashboard/OrdersPage'
import type { OrderRead, Restaurant } from '../../lib/types'
import { jsonResponse, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const restaurant: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: true,
  role: 'owner',
}

function order(overrides: Partial<OrderRead>): OrderRead {
  return {
    id: 'o1',
    restaurant_id: 'r1',
    status: 'pending',
    customer_name: 'Juan Pérez',
    order_type: 'mesa',
    table_or_address: 'Mesa 4',
    table_id: null,
    notes: null,
    total: '10.00',
    created_at: '2026-07-07T10:00:00Z',
    updated_at: '2026-07-07T10:00:00Z',
    whatsapp_url: null,
    handled_by_id: null,
    handled_by_name: null,
    cash_shift_id: null,
    payment_method: 'cash',
    payment_status: 'none',
    payment_url: null,
    items: [],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>,
  )
}

describe('OrdersPage — payment badge (RF-29)', () => {
  it('shows "Pagado · Mercado Pago" on mercadopago orders', async () => {
    routeFetch([
      {
        method: 'GET',
        match: '/orders',
        response: jsonResponse([
          order({ payment_method: 'mercadopago', payment_status: 'approved' }),
        ]),
      },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    renderPage()

    expect(await screen.findByText('Pagado · Mercado Pago')).toBeInTheDocument()
  })

  it('shows no payment badge on cash orders', async () => {
    routeFetch([
      { method: 'GET', match: '/orders', response: jsonResponse([order({})]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    renderPage()

    await screen.findByText('Juan Pérez')
    expect(screen.queryByText(/mercado pago/i)).not.toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import OrdersPage from '../../pages/dashboard/OrdersPage'
import type { OrderRead, Restaurant } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

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

const order: OrderRead = {
  id: 'o1',
  restaurant_id: 'r1',
  status: 'pending',
  customer_name: 'Juan Pérez',
  order_type: 'mesa',
  table_or_address: 'Mesa 4',
  notes: null,
  total: '23.00',
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
  items: [
    {
      id: 'oi1',
      item_id: 'i1',
      name_snapshot: 'Margherita',
      unit_price_snapshot: '11.50',
      quantity: 2,
      special_instructions: 'Bien cocida',
      subtotal: '23.00',
      modifiers: [
        { id: 'oim1', name_snapshot: 'Extra queso', price_snapshot: '1.50', type: 'extra' },
      ],
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>,
  )
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('OrdersPage', () => {
  it('lists orders with their items and modifiers', async () => {
    routeFetch([
      { method: 'GET', match: '/orders', response: jsonResponse([order]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurantEnabled]) },
    ])

    renderPage()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText(/Margherita/)).toBeInTheDocument()
    expect(screen.getByText(/Extra queso/)).toBeInTheDocument()
    expect(screen.getByText(/Bien cocida/)).toBeInTheDocument()
    expect(screen.getByText(/Total: \$23\.00/)).toBeInTheDocument()
  })

  it('shows an error when the orders list fails to load', async () => {
    routeFetch([
      { method: 'GET', match: '/orders', response: jsonResponse({ detail: 'boom' }, 500) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurantEnabled]) },
    ])

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar los pedidos/i)
  })

  it('transitions an order and PATCHes the correct status', async () => {
    const accepted: OrderRead = { ...order, status: 'accepted' }
    routeFetch([
      { method: 'PATCH', match: '/orders/', response: jsonResponse(accepted) },
      { method: 'GET', match: '/orders', response: jsonResponse([order]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurantEnabled]) },
    ])

    renderPage()
    await screen.findByText('Juan Pérez')

    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))

    // The badge reflects the new status returned by the PATCH.
    expect(await screen.findByText('Aceptado')).toBeInTheDocument()

    const patches = callsMatching('/orders/', 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].url).toBe('http://api.test/restaurants/r1/orders/o1')
    expect(JSON.parse(patches[0].body as string)).toEqual({ status: 'accepted' })
  })

  it('shows a clear (non-error) message when ordering is disabled', async () => {
    routeFetch([
      {
        method: 'GET',
        match: '/restaurants',
        response: jsonResponse([{ ...restaurantEnabled, orders_enabled: false }]),
      },
    ])

    renderPage()

    expect(await screen.findByText(/recepción de pedidos está desactivada/i)).toBeInTheDocument()
    // It's an informational message, not an error alert.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // And it never even queried the orders endpoint.
    await waitFor(() => expect(callsMatching('/orders', 'GET')).toHaveLength(0))
  })
})

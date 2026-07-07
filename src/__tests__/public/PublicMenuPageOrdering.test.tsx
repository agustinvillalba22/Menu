import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicMenuPage from '../../pages/public/PublicMenuPage'
import type { PublicMenuResponse } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

/** Menu fixture with ordering ON and an item carrying two real modifiers. */
const menu: PublicMenuResponse = {
  restaurant: { name: 'Boulette', slug: 'boulette', orders_enabled: true },
  style: null,
  categories: [
    {
      id: 'c1',
      name: 'Pizzas',
      type: 'food',
      subcategories: [
        {
          id: 's1',
          name: 'Clásicas',
          items: [
            {
              id: 'i1',
              name: 'Margherita',
              description: 'Tomate y mozzarella',
              price: '10.00',
              image_url: null,
              tags: [],
              modifiers: [
                { id: 'm1', name: 'Extra queso', price_delta: '1.50', type: 'extra' },
                { id: 'm2', name: 'Sin cebolla', price_delta: '0.00', type: 'removal' },
              ],
            },
          ],
        },
      ],
    },
  ],
}

const readOnlyMenu: PublicMenuResponse = {
  ...menu,
  restaurant: { ...menu.restaurant, orders_enabled: false },
}

function renderMenu(token = 'valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/menu/${token}`]}>
      <Routes>
        <Route path="/menu/:qrToken" element={<PublicMenuPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const createdOrder = {
  id: 'ab12cd34-0000-0000-0000-000000000000',
  restaurant_id: 'r1',
  status: 'pending',
  customer_name: 'Juan Pérez',
  order_type: 'mesa',
  table_or_address: 'Mesa 4',
  notes: null,
  total: '23.00',
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
  items: [],
}

describe('PublicMenuPage — ordering enabled', () => {
  it('shows the cart button when ordering is enabled', async () => {
    routeFetch([{ method: 'GET', match: '/menu/', response: jsonResponse(menu) }])

    renderMenu()

    expect(await screen.findByRole('heading', { name: 'Boulette', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver carrito' })).toBeInTheDocument()
  })

  it('adds an item to the cart and reflects it in the counter', async () => {
    routeFetch([{ method: 'GET', match: '/menu/', response: jsonResponse(menu) }])

    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    // Open the detail modal via the accessible quick-add button on the card.
    await userEvent.click(screen.getByRole('button', { name: /agregar margherita/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Margherita' })
    expect(dialog).toBeInTheDocument()

    // Add to cart with the default quantity of 1, no modifiers.
    await userEvent.click(screen.getByRole('button', { name: /añadir al pedido/i }))

    // Modal closes and the header cart badge shows the new count.
    expect(screen.queryByRole('dialog', { name: 'Margherita' })).not.toBeInTheDocument()
    expect(screen.getByTestId('cart-count-badge')).toHaveTextContent('1')
  })

  it('shows and lets the guest select modifiers in the detail modal', async () => {
    routeFetch([{ method: 'GET', match: '/menu/', response: jsonResponse(menu) }])

    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    await userEvent.click(screen.getByRole('button', { name: /agregar margherita/i }))
    await screen.findByRole('dialog', { name: 'Margherita' })

    const modifier = screen.getByRole('button', { name: /extra queso/i })
    expect(modifier).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(modifier)
    expect(modifier).toHaveAttribute('aria-pressed', 'true')

    // Second modifier is offered too.
    expect(screen.getByRole('button', { name: /sin cebolla/i })).toBeInTheDocument()
  })

  it('checks out: POSTs the correct order payload and confirms with the order number', async () => {
    routeFetch([
      { method: 'POST', match: '/orders', response: jsonResponse(createdOrder, 201) },
      { method: 'GET', match: '/menu/', response: jsonResponse(menu) },
    ])

    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    // Add a Margherita + "Extra queso" modifier.
    await userEvent.click(screen.getByRole('button', { name: /agregar margherita/i }))
    await screen.findByRole('dialog', { name: 'Margherita' })
    await userEvent.click(screen.getByRole('button', { name: /extra queso/i }))
    await userEvent.click(screen.getByRole('button', { name: /añadir al pedido/i }))

    // Open cart → checkout.
    await userEvent.click(screen.getByRole('button', { name: 'Ver carrito' }))
    await userEvent.click(screen.getByRole('button', { name: /finalizar pedido/i }))

    // Fill the checkout form (order_type defaults to "mesa" → location required).
    await userEvent.type(screen.getByLabelText(/tu nombre/i), 'Juan Pérez')
    await userEvent.type(screen.getByLabelText(/número de mesa/i), 'Mesa 4')
    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    // Confirmation shows the backend-provided order number.
    const confirmation = await screen.findByTestId('order-confirmation')
    expect(confirmation).toBeInTheDocument()
    expect(screen.getByTestId('order-number')).toHaveTextContent('#ab12cd34')

    // The POST body carried exactly the expected order payload.
    const posts = vi
      .mocked(fetch)
      .mock.calls.map((c) => readCall(c as [unknown, unknown]))
      .filter((c) => c.method === 'POST' && c.url.includes('/orders'))
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe('http://api.test/menu/valid-token/orders')
    const body = JSON.parse(posts[0].body as string)
    expect(body).toEqual({
      customer_name: 'Juan Pérez',
      order_type: 'mesa',
      table_or_address: 'Mesa 4',
      notes: null,
      items: [
        {
          item_id: 'i1',
          quantity: 1,
          modifier_ids: ['m1'],
          special_instructions: null,
        },
      ],
    })
  })
})

describe('PublicMenuPage — ordering disabled', () => {
  it('does not show any cart / order button when ordering is disabled', async () => {
    routeFetch([{ method: 'GET', match: '/menu/', response: jsonResponse(readOnlyMenu) }])

    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    expect(screen.queryByRole('button', { name: 'Ver carrito' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /agregar margherita/i })).not.toBeInTheDocument()
  })
})

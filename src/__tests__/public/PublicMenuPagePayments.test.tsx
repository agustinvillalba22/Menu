import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PublicMenuPage from '../../pages/public/PublicMenuPage'
import { cartStorageKey } from '../../components/public/cart'
import type { PublicMenuResponse } from '../../lib/types'
import { errorResponse, jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()

const assign = vi.fn()
const realLocation = window.location

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, assign },
  })
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

const baseMenu: PublicMenuResponse = {
  restaurant: {
    name: 'Boulette',
    slug: 'boulette',
    orders_enabled: true,
    address: '',
    phone: '',
    logo_url: null,
    timezone: '',
    business_hours: [],
    is_open_now: false,
    whatsapp_enabled: false,
  },
  style: null,
  promo: null,
  tables: [],
  categories: [
    {
      id: 'c1',
      name: 'Pizzas',
      type: 'food',
      icon: null,
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
              category_id: 'c1',
              tags: [],
              modifiers: [],
            },
          ],
        },
      ],
    },
  ],
}

const mpMenu: PublicMenuResponse = {
  ...baseMenu,
  restaurant: { ...baseMenu.restaurant, accepts_mercadopago: true },
}

const mpOrder = {
  id: 'ab12cd34-0000-0000-0000-000000000000',
  restaurant_id: 'r1',
  status: 'pending',
  customer_name: 'Juan Pérez',
  order_type: 'mesa',
  table_or_address: 'Mesa 4',
  notes: null,
  total: '10.00',
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
  items: [],
  whatsapp_url: 'https://wa.me/5491100000000',
  payment_method: 'mercadopago',
  payment_status: 'pending',
  payment_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc',
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="search">{loc.search}</div>
}

function renderMenu(entry = '/menu/valid-token') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/menu/:qrToken" element={<PublicMenuPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

function postedOrders() {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.method === 'POST' && c.url.endsWith('/orders'))
}

async function openCheckout() {
  await screen.findByRole('heading', { name: 'Boulette', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: /agregar margherita/i }))
  await userEvent.click(await screen.findByRole('button', { name: /añadir al pedido/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Ver carrito' }))
  await userEvent.click(screen.getByRole('button', { name: /finalizar pedido/i }))
  await userEvent.type(await screen.findByLabelText(/tu nombre/i), 'Juan Pérez')
  await userEvent.type(screen.getByLabelText(/número de mesa/i), 'Mesa 4')
}

describe('Checkout — Mercado Pago payment method (RF-27)', () => {
  it('does not render the payment selector nor send payment_method when the menu does not accept Mercado Pago', async () => {
    routeFetch([
      { method: 'POST', match: '/orders', response: jsonResponse({ ...mpOrder, payment_method: 'cash', payment_status: 'none', payment_url: null }, 201) },
      { method: 'GET', match: '/menu/', response: jsonResponse(baseMenu) },
    ])

    renderMenu()
    await openCheckout()

    expect(screen.queryByRole('button', { name: /pagar con mercado pago/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/pagar en el local/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))
    await screen.findByTestId('order-confirmation')

    const body = JSON.parse(postedOrders()[0].body as string)
    expect(body).not.toHaveProperty('payment_method')
  })

  it('offers both methods with "Pagar en el local" selected by default and keeps the cash flow', async () => {
    routeFetch([
      { method: 'POST', match: '/orders', response: jsonResponse({ ...mpOrder, payment_method: 'cash', payment_status: 'none', payment_url: null }, 201) },
      { method: 'GET', match: '/menu/', response: jsonResponse(mpMenu) },
    ])

    renderMenu()
    await openCheckout()

    expect(screen.getByRole('button', { name: /pagar en el local/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /pagar con mercado pago/i })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    expect(await screen.findByTestId('order-confirmation')).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
    expect(JSON.parse(postedOrders()[0].body as string)).not.toHaveProperty('payment_method')
  })

  it('also reads accepts_mercadopago from the top level of the menu response', async () => {
    routeFetch([{ method: 'GET', match: '/menu/', response: jsonResponse({ ...baseMenu, accepts_mercadopago: true }) }])

    renderMenu()
    await openCheckout()

    expect(screen.getByRole('button', { name: /pagar con mercado pago/i })).toBeInTheDocument()
  })

  it('with Mercado Pago sends payment_method, redirects to payment_url and leaves the cart intact', async () => {
    routeFetch([
      { method: 'POST', match: '/orders', response: jsonResponse(mpOrder, 201) },
      { method: 'GET', match: '/menu/', response: jsonResponse(mpMenu) },
    ])

    renderMenu()
    await openCheckout()
    await userEvent.click(screen.getByRole('button', { name: /pagar con mercado pago/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(mpOrder.payment_url))
    expect(JSON.parse(postedOrders()[0].body as string).payment_method).toBe('mercadopago')
    expect(screen.queryByTestId('order-confirmation')).not.toBeInTheDocument()
    expect(screen.queryByTestId('whatsapp-confirm-button')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(cartStorageKey('valid-token')) ?? '[]')).toHaveLength(1)
  })

  it('shows a message and lets the guest pick another method on mercadopago_unavailable', async () => {
    routeFetch([
      { method: 'POST', match: '/orders', response: errorResponse('mercadopago_unavailable', 409) },
      { method: 'GET', match: '/menu/', response: jsonResponse(mpMenu) },
    ])

    renderMenu()
    await openCheckout()
    await userEvent.click(screen.getByRole('button', { name: /pagar con mercado pago/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/mercado pago no está disponible/i)
    expect(assign).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /pagar en el local/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /confirmar pedido/i })).toBeEnabled()
  })

  it('shows a provider error message on payment_provider_error', async () => {
    routeFetch([
      { method: 'POST', match: '/orders', response: errorResponse('payment_provider_error', 502) },
      { method: 'GET', match: '/menu/', response: jsonResponse(mpMenu) },
    ])

    renderMenu()
    await openCheckout()
    await userEvent.click(screen.getByRole('button', { name: /pagar con mercado pago/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos iniciar el pago/i)
    expect(assign).not.toHaveBeenCalled()
  })
})

describe('Payment return banner (RF-28)', () => {
  const ORDER = 'ord-1'

  function paymentRoute(...statuses: string[]) {
    let i = 0
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes(`/orders/${ORDER}/payment`)) {
        const s = statuses[Math.min(i, statuses.length - 1)]
        i += 1
        return jsonResponse({ payment_status: s, status: 'pending' })
      }
      return jsonResponse(mpMenu)
    })
  }

  function paymentCalls() {
    return vi
      .mocked(fetch)
      .mock.calls.filter((c) => String(c[0]).includes('/payment')).length
  }

  function seedCart() {
    localStorage.setItem(
      cartStorageKey('valid-token'),
      JSON.stringify([
        {
          lineId: 'i1',
          item: baseMenu.categories[0].subcategories[0].items[0],
          modifiers: [],
          quantity: 1,
        },
      ]),
    )
  }

  const cartLines = () => JSON.parse(localStorage.getItem(cartStorageKey('valid-token')) ?? '[]')

  it('without ?pago behaves as today: no banner and no polling', async () => {
    paymentRoute('pending')
    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(paymentCalls()).toBe(0)
  })

  it('approved: shows the success banner and empties the cart', async () => {
    seedCart()
    paymentRoute('approved')

    renderMenu(`/menu/valid-token?pago=ok&order=${ORDER}`)

    expect(await screen.findByText(/¡pago recibido! tu pedido está en preparación/i)).toBeInTheDocument()
    await vi.waitFor(() => expect(cartLines()).toHaveLength(0))
  })

  it('rejected: shows the failure banner and keeps the cart', async () => {
    seedCart()
    paymentRoute('rejected')

    renderMenu(`/menu/valid-token?pago=pendiente&order=${ORDER}`)

    expect(await screen.findByText(/el pago no se completó\. podés intentar de nuevo/i)).toBeInTheDocument()
    expect(cartLines()).toHaveLength(1)
  })

  it('?pago=error shows the failure banner without polling and keeps the cart', async () => {
    seedCart()
    paymentRoute('pending')

    renderMenu(`/menu/valid-token?pago=error&order=${ORDER}`)

    expect(await screen.findByText(/el pago no se completó/i)).toBeInTheDocument()
    expect(paymentCalls()).toBe(0)
    expect(cartLines()).toHaveLength(1)
  })

  it('polls every 3 s while pending and resolves when the payment is approved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    seedCart()
    paymentRoute('pending', 'pending', 'approved')

    renderMenu(`/menu/valid-token?pago=ok&order=${ORDER}`)

    expect(await screen.findByText(/confirmando tu pago/i)).toBeInTheDocument()
    expect(cartLines()).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(await screen.findByText(/¡pago recibido!/i)).toBeInTheDocument()
    expect(paymentCalls()).toBe(3)
    expect(cartLines()).toHaveLength(0)
  })

  it('gives up after 10 attempts still pending with "Estamos confirmando tu pago." and keeps the cart', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    seedCart()
    paymentRoute('pending')

    renderMenu(`/menu/valid-token?pago=ok&order=${ORDER}`)
    await screen.findByText(/confirmando tu pago/i)

    for (let i = 0; i < 12; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
    }

    expect(await screen.findByText('Estamos confirmando tu pago.')).toBeInTheDocument()
    expect(paymentCalls()).toBe(10)
    expect(cartLines()).toHaveLength(1)
  })

  it('closing the banner clears the pago and order query params', async () => {
    paymentRoute('approved')

    renderMenu(`/menu/valid-token?pago=ok&order=${ORDER}`)
    await screen.findByText(/¡pago recibido!/i)

    await userEvent.click(screen.getByRole('button', { name: /cerrar aviso/i }))

    expect(screen.queryByText(/¡pago recibido!/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/)
  })
})

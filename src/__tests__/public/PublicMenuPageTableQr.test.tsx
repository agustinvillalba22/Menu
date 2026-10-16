import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicMenuPage from '../../pages/public/PublicMenuPage'
import type { PublicMenuResponse } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

const menu: PublicMenuResponse = {
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
  tables: [
    { id: 't1', number: 1, capacity: 2 },
    { id: 't5', number: 5, capacity: null },
  ],
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
              description: 'Tomate',
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

const createdOrder = {
  id: 'ab12cd34-0000-0000-0000-000000000000',
  restaurant_id: 'r1',
  status: 'pending',
  customer_name: 'Ana',
  order_type: 'mesa',
  table_or_address: null,
  notes: null,
  total: '10.00',
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
  items: [],
}

function renderMenu(search = '', data: PublicMenuResponse = menu) {
  routeFetch([
    { method: 'POST', match: '/orders', response: jsonResponse(createdOrder, 201) },
    { method: 'GET', match: '/menu/', response: jsonResponse(data) },
  ])
  return render(
    <MemoryRouter initialEntries={[`/menu/tok${search}`]}>
      <Link to="/menu/tok">sin-query</Link>
      <Routes>
        <Route path="/menu/:qrToken" element={<PublicMenuPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openCheckout() {
  await screen.findByRole('heading', { name: 'Boulette', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: /agregar margherita/i }))
  await screen.findByRole('dialog', { name: 'Margherita' })
  await userEvent.click(screen.getByRole('button', { name: /añadir al pedido/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Ver carrito' }))
  await userEvent.click(screen.getByRole('button', { name: /finalizar pedido/i }))
}

describe('PublicMenuPage — QR por mesa (M35)', () => {
  it('?mesa=5 muestra el chip y preselecciona el select', async () => {
    renderMenu('?mesa=5')
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(screen.getByText('Mesa 5')).toBeInTheDocument()
    await openCheckout()
    const select = screen.getByRole('combobox', { name: /número de mesa/i })
    expect(select).toHaveValue('t5')
  })

  it.each(['?mesa=abc', '?mesa=5x', '?mesa=0', '?mesa=-1', '?mesa=1.5', '?mesa=', '?mesa=99'])(
    '%s se ignora: sin chip y select sin preselección',
    async (q) => {
      renderMenu(q)
      await screen.findByRole('heading', { name: 'Boulette', level: 1 })
      expect(screen.queryByText(/^Mesa \d+$/)).not.toBeInTheDocument()
      await openCheckout()
      expect(screen.getByRole('combobox', { name: /número de mesa/i })).toHaveValue('')
    },
  )

  it('no muestra chip si el restaurante no tiene mesas y mantiene el input libre', async () => {
    renderMenu('?mesa=5', { ...menu, tables: [] })
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(screen.queryByText('Mesa 5')).not.toBeInTheDocument()
    await openCheckout()
    expect(screen.getByRole('textbox', { name: /número de mesa/i })).toBeInTheDocument()
  })

  it('no muestra chip si los pedidos están deshabilitados', async () => {
    renderMenu('?mesa=5', { ...menu, restaurant: { ...menu.restaurant, orders_enabled: false } })
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(screen.queryByText('Mesa 5')).not.toBeInTheDocument()
  })

  it('guarda la mesa en sessionStorage y la recupera al navegar sin query', async () => {
    renderMenu('?mesa=5')
    await screen.findByText('Mesa 5')
    expect(sessionStorage.getItem('menu_table_tok')).toBe('5')
    await userEvent.click(screen.getByText('sin-query'))
    expect(await screen.findByText('Mesa 5')).toBeInTheDocument()
  })

  it('usa la mesa guardada cuando no hay query', async () => {
    sessionStorage.setItem('menu_table_tok', '1')
    renderMenu('')
    expect(await screen.findByText('Mesa 1')).toBeInTheDocument()
  })

  it('un ?mesa= válido nuevo reemplaza al guardado', async () => {
    sessionStorage.setItem('menu_table_tok', '1')
    renderMenu('?mesa=5')
    expect(await screen.findByText('Mesa 5')).toBeInTheDocument()
    expect(sessionStorage.getItem('menu_table_tok')).toBe('5')
  })

  it('descarta la mesa guardada si ya no existe', async () => {
    sessionStorage.setItem('menu_table_tok', '77')
    renderMenu('')
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(screen.queryByText(/^Mesa \d+$/)).not.toBeInTheDocument()
  })

  it('sessionStorage que lanza no rompe y la URL sigue funcionando', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderMenu('?mesa=5')
    expect(await screen.findByText('Mesa 5')).toBeInTheDocument()
  })

  it('cambiar a "para llevar" respeta la elección del usuario', async () => {
    renderMenu('?mesa=5')
    await openCheckout()
    await userEvent.click(screen.getByRole('button', { name: /para llevar/i }))
    expect(screen.queryByRole('combobox', { name: /número de mesa/i })).not.toBeInTheDocument()
  })

  it('el POST envía table_id correcto y table_or_address null', async () => {
    renderMenu('?mesa=5')
    await openCheckout()
    await userEvent.type(screen.getByLabelText(/tu nombre/i), 'Ana')
    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))
    await screen.findByTestId('order-confirmation')
    const posts = vi
      .mocked(fetch)
      .mock.calls.map((c) => readCall(c as [unknown, unknown]))
      .filter((c) => c.method === 'POST' && c.url.includes('/orders'))
    const body = JSON.parse(posts[0].body as string)
    expect(body.table_id).toBe('t5')
    expect(body.table_or_address).toBeNull()
  })
})

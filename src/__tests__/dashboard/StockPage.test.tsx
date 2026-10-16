import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StockPage from '../../pages/dashboard/StockPage'
import type { Restaurant, StockItem, Supplier } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

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

const supplier: Supplier = {
  id: 'sup1',
  name: 'Distribuidora X',
  category: null,
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  delivery_days: null,
  payment_terms: null,
  notes: null,
  active: true,
}

function stockItem(overrides: Partial<StockItem>): StockItem {
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

describe('StockPage', () => {
  // CA-04: badge de estado según quantity vs min_threshold.
  it('shows Crítico, Bajo and Óptimo badges correctly', async () => {
    routeFetch([
      {
        method: 'GET',
        match: '/stock-items',
        response: jsonResponse([
          stockItem({ id: 'crit', name: 'Sal', quantity: '0.00', min_threshold: '1.00' }),
          stockItem({ id: 'low', name: 'Harina', quantity: '1.00', min_threshold: '2.00' }),
          stockItem({ id: 'ok', name: 'Azúcar', quantity: '10.00', min_threshold: '2.00' }),
        ]),
      },
      { method: 'GET', match: '/suppliers', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<StockPage />)

    const sal = (await screen.findByText('Sal')).closest('li')
    const harina = screen.getByText('Harina').closest('li')
    const azucar = screen.getByText('Azúcar').closest('li')
    expect(sal).toHaveTextContent('Crítico')
    expect(harina).toHaveTextContent('Bajo')
    expect(azucar).toHaveTextContent('Óptimo')
  })

  // CA-05: el select de proveedor en el form de insumo ofrece "Sin proveedor".
  it('creates a stock item', async () => {
    routeFetch([
      { method: 'GET', match: '/stock-items', response: jsonResponse([]) },
      { method: 'GET', match: '/suppliers', response: jsonResponse([supplier]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      {
        method: 'POST',
        match: '/stock-items',
        response: jsonResponse(stockItem({ id: 'new1', name: 'Tomate', category: 'verduras_frescos' }), 201),
      },
    ])

    render(<StockPage />)
    await screen.findByText('Todavía no cargaste ningún insumo.')

    await userEvent.type(screen.getAllByLabelText(/^nombre$/i)[0], 'Tomate')
    await userEvent.selectOptions(screen.getByLabelText(/categoría/i), 'verduras_frescos')
    await userEvent.click(screen.getByRole('button', { name: /agregar insumo/i }))

    expect(await screen.findByText('Tomate')).toBeInTheDocument()
    const post = vi
      .mocked(fetch)
      .mock.calls.map((c) => readCall(c as [unknown, unknown]))
      .find((c) => c.method === 'POST' && c.url.includes('/stock-items'))
    expect(JSON.parse(post!.body as string)).toEqual({
      name: 'Tomate',
      category: 'verduras_frescos',
      unit: 'kg',
    })
  })

  it('no longer renders the suppliers section (moved to /dashboard/suppliers)', async () => {
    routeFetch([
      { method: 'GET', match: '/stock-items', response: jsonResponse([]) },
      { method: 'GET', match: '/suppliers', response: jsonResponse([supplier]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<StockPage />)
    await screen.findByText('Todavía no cargaste ningún insumo.')

    expect(screen.queryByRole('button', { name: /agregar proveedor/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Proveedores' })).not.toBeInTheDocument()
  })

  it('shows the linked supplier name on a stock item row', async () => {
    routeFetch([
      {
        method: 'GET',
        match: '/stock-items',
        response: jsonResponse([stockItem({ supplier_id: 'sup1' })]),
      },
      { method: 'GET', match: '/suppliers', response: jsonResponse([supplier]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<StockPage />)

    const row = (await screen.findByText('Harina')).closest('li')
    expect(row).toHaveTextContent('Distribuidora X')
  })
})

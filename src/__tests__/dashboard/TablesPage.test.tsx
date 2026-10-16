import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TablesPage from '../../pages/dashboard/TablesPage'
import type { OrderRead, Restaurant, Table } from '../../lib/types'
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

const tables: Table[] = [
  { id: 't1', number: 1, capacity: 4 },
  { id: 't2', number: 2, capacity: null },
]

function order(overrides: Partial<OrderRead>): OrderRead {
  return {
    id: 'o1',
    restaurant_id: 'r1',
    status: 'pending',
    customer_name: 'Ana',
    order_type: 'mesa',
    table_or_address: 'Mesa 1',
    table_id: 't1',
    notes: null,
    total: '10.00',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    whatsapp_url: null,
    handled_by_id: null,
    handled_by_name: null,
    cash_shift_id: null,
    items: [],
    ...overrides,
  }
}

describe('TablesPage', () => {
  // CA-07: a table with an active order is "Ocupada"; one without is "Libre".
  it('shows Ocupada for a table with a pending order and Libre for the other', async () => {
    routeFetch([
      { method: 'GET', match: '/tables', response: jsonResponse(tables) },
      { method: 'GET', match: '/orders', response: jsonResponse([order({ table_id: 't1', status: 'pending' })]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<TablesPage />)

    await screen.findByText('Mesa 1')
    const rows = screen.getAllByRole('listitem')
    const row1 = rows.find((r) => r.textContent?.includes('Mesa 1'))
    const row2 = rows.find((r) => r.textContent?.includes('Mesa 2'))
    expect(row1).toHaveTextContent('Ocupada')
    expect(row2).toHaveTextContent('Libre')
  })

  // A completed order on a table does not count as occupying it.
  it('does not count a completed order as occupying the table', async () => {
    routeFetch([
      { method: 'GET', match: '/tables', response: jsonResponse(tables) },
      { method: 'GET', match: '/orders', response: jsonResponse([order({ table_id: 't1', status: 'completed' })]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<TablesPage />)

    const row1 = (await screen.findAllByRole('listitem')).find((r) => r.textContent?.includes('Mesa 1'))
    expect(row1).toHaveTextContent('Libre')
  })

  // CA-01 (frontend half): creating a table POSTs number/capacity and lists it.
  it('creates a table and lists it', async () => {
    routeFetch([
      { method: 'GET', match: '/tables', response: jsonResponse([]) },
      { method: 'GET', match: '/orders', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      { method: 'POST', match: '/tables', response: jsonResponse({ id: 't9', number: 5, capacity: 6 }, 201) },
    ])

    render(<TablesPage />)
    await screen.findByText('Todavía no cargaste ninguna mesa.')

    await userEvent.type(screen.getByLabelText(/número/i), '5')
    await userEvent.type(screen.getByLabelText(/capacidad/i), '6')
    await userEvent.click(screen.getByRole('button', { name: /agregar mesa/i }))

    expect(await screen.findByText('Mesa 5')).toBeInTheDocument()
    const post = vi
      .mocked(fetch)
      .mock.calls.map((c) => readCall(c as [unknown, unknown]))
      .find((c) => c.method === 'POST')
    expect(JSON.parse(post!.body as string)).toEqual({ number: 5, capacity: 6 })
  })

  // CA-01 (duplicate number) — surfaces the 409 as a friendly message.
  it('shows a friendly error when the table number is already taken', async () => {
    routeFetch([
      { method: 'GET', match: '/tables', response: jsonResponse([]) },
      { method: 'GET', match: '/orders', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      {
        method: 'POST',
        match: '/tables',
        response: jsonResponse({ detail: 'table_number_taken' }, 409),
      },
    ])

    render(<TablesPage />)
    await screen.findByText('Todavía no cargaste ninguna mesa.')

    await userEvent.type(screen.getByLabelText(/número/i), '1')
    await userEvent.click(screen.getByRole('button', { name: /agregar mesa/i }))

    expect(await screen.findByText(/ya existe una mesa con ese número/i)).toBeInTheDocument()
  })

  // Deleting a table removes it from the list after confirming.
  it('deletes a table after confirming', async () => {
    routeFetch([
      { method: 'GET', match: '/tables', response: jsonResponse([tables[0]]) },
      { method: 'GET', match: '/orders', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      { method: 'DELETE', match: '/tables/t1', response: jsonResponse(null, 204) },
    ])

    render(<TablesPage />)
    await screen.findByText('Mesa 1')

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))
    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))

    expect(screen.queryByText('Mesa 1')).not.toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminRestaurantsPage from '../../pages/admin/AdminRestaurantsPage'
import type { AdminRestaurant } from '../../lib/types'
import { jsonResponse, readCall } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const boulette: AdminRestaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  is_active: true,
  orders_enabled: false,
  owner_email: 'owner@example.com',
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('AdminRestaurantsPage', () => {
  it('renders a table with restaurants, read-only orders_enabled, and an is_active toggle', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([boulette]))

    render(<AdminRestaurantsPage />)

    expect(await screen.findByText('Boulette')).toBeInTheDocument()
    expect(screen.getByText('boulette')).toBeInTheDocument()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()

    const row = screen.getByText('Boulette').closest('tr') as HTMLElement
    // Only one interactive switch per row: is_active. orders_enabled is read-only.
    expect(within(row).getAllByRole('switch')).toHaveLength(1)
    expect(within(row).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  // CA-04: toggling is_active PATCHes /admin/restaurants/{id} with {is_active: false}.
  it('toggling is_active PATCHes /admin/restaurants/{id} with {is_active: false}', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.endsWith('/admin/restaurants') && method === 'GET') {
        return jsonResponse([boulette])
      }
      if (url.includes('/admin/restaurants/r1') && method === 'PATCH') {
        return jsonResponse({ ...boulette, is_active: false })
      }
      throw new Error(`No mock route for ${method} ${url}`)
    })

    render(<AdminRestaurantsPage />)

    const row = (await screen.findByText('Boulette')).closest('tr') as HTMLElement
    await userEvent.click(within(row).getByRole('switch'))

    const patches = callsMatching('/admin/restaurants/r1', 'PATCH')
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0].body as string)).toEqual({ is_active: false })
  })

  // CA-05: importing a CSV for a specific row POSTs /restaurants/{id}/items/import
  // with that row's id.
  it('opens the CSV import form for a row and imports against that restaurant id', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.endsWith('/admin/restaurants') && method === 'GET') {
        return jsonResponse([boulette])
      }
      if (url.includes('/items/import') && method === 'POST') {
        return jsonResponse({ imported: 1, errors: [] })
      }
      throw new Error(`No mock route for ${method} ${url}`)
    })

    render(<AdminRestaurantsPage />)

    await screen.findByText('Boulette')
    await userEvent.click(screen.getByRole('button', { name: /importar csv/i }))

    await userEvent.upload(
      screen.getByLabelText(/archivo csv/i),
      new File(['name,price\nFlan,3.00'], 'menu.csv', { type: 'text/csv' }),
    )
    await userEvent.click(screen.getByRole('button', { name: /^importar$/i }))

    const imports = callsMatching('/items/import', 'POST')
    expect(imports).toHaveLength(1)
    expect(imports[0].url).toBe('http://api.test/restaurants/r1/items/import')
  })

  it('shows an error state when the list fails to load', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server error',
      json: async () => ({ detail: 'boom' }),
      text: async () => JSON.stringify({ detail: 'boom' }),
    } as unknown as Response)

    render(<AdminRestaurantsPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

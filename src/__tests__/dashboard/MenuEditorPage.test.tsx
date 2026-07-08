import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MenuEditorPage from '../../pages/dashboard/MenuEditorPage'
import type { Category, Restaurant } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const restaurant: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: false,
  role: 'owner',
}

const entradas: Category = { id: 'c1', name: 'Entradas', type: 'food' }

/** Recorded fetch calls whose URL contains `fragment`, optionally by method. */
function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('MenuEditorPage', () => {
  // CA-01: restaurant with no categories → create form + empty list, no error.
  it('shows the create form and an empty-state (no error) when there are no categories', async () => {
    routeFetch([
      { method: 'GET', match: '/categories', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<MenuEditorPage />)

    expect(await screen.findByLabelText(/nueva categoría/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agregar categoría/i })).toBeInTheDocument()
    expect(await screen.findByText(/todavía no hay categorías/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // CA-02: submitting the form POSTs {name, type} and shows the new category.
  it('creates a category and shows it without a reload', async () => {
    routeFetch([
      { method: 'POST', match: '/categories', response: jsonResponse(entradas) },
      { method: 'GET', match: '/categories', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<MenuEditorPage />)

    const nameInput = await screen.findByLabelText(/nueva categoría/i)
    await userEvent.type(nameInput, 'Entradas')
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), 'food')
    await userEvent.click(screen.getByRole('button', { name: /agregar categoría/i }))

    // The new category appears in the tree.
    expect(await screen.findByText('Entradas')).toBeInTheDocument()

    const posts = callsMatching('/categories', 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe('http://api.test/restaurants/r1/categories')
    expect(JSON.parse(posts[0].body as string)).toEqual({ name: 'Entradas', type: 'food' })
  })

  // CA-04 (legacy numbering) / M12.1 CA-01: deleting a category requires an
  // inline confirmation before it DELETEs and removes its subtree from the UI.
  it('removes a category from the UI after confirming the DELETE', async () => {
    routeFetch([
      { method: 'DELETE', match: '/categories', response: jsonResponse(undefined, 204) },
      { method: 'GET', match: '/categories', response: jsonResponse([entradas]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<MenuEditorPage />)

    const row = (await screen.findByText('Entradas')).closest('li') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: /^borrar$/i }))

    // No DELETE yet — an inline confirmation is shown instead.
    expect(callsMatching('/categories', 'DELETE')).toHaveLength(0)
    expect(screen.getByText('Entradas')).toBeInTheDocument()

    await userEvent.click(within(row).getByRole('button', { name: /sí, borrar/i }))

    await waitFor(() => expect(screen.queryByText('Entradas')).not.toBeInTheDocument())

    const deletes = callsMatching('/categories', 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].url).toBe('http://api.test/restaurants/r1/categories/c1')
  })

  // M12.1 CA-05 / RF-05: a successful CSV import re-fetches the category tree
  // so a newly-imported category shows up without a manual page reload.
  it('refreshes the category tree after a successful CSV import', async () => {
    const postres: Category = { id: 'c2', name: 'Postres', type: 'food' }
    let categoriesCallCount = 0

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      // Check the most specific paths first — the categories/import URLs also
      // contain "/restaurants/<id>/...", so that check must come last.
      if (url.includes('/items/import') && method === 'POST') {
        return jsonResponse({ imported: 1, errors: [] })
      }
      if (url.endsWith('/categories') && method === 'GET') {
        categoriesCallCount += 1
        // First load: only "Entradas". After the CSV import refresh: also "Postres".
        return jsonResponse(categoriesCallCount === 1 ? [entradas] : [entradas, postres])
      }
      if (url.endsWith('/restaurants') && method === 'GET') {
        return jsonResponse([restaurant])
      }
      throw new Error(`No mock route for ${method} ${url}`)
    })

    render(<MenuEditorPage />)

    expect(await screen.findByText('Entradas')).toBeInTheDocument()
    expect(screen.queryByText('Postres')).not.toBeInTheDocument()

    await userEvent.upload(
      screen.getByLabelText(/archivo csv/i),
      new File(['name,price\nFlan,3.00'], 'menu.csv', { type: 'text/csv' }),
    )
    await userEvent.click(screen.getByRole('button', { name: /importar/i }))

    // The tree re-fetches and now shows the category created by the import.
    expect(await screen.findByText('Postres')).toBeInTheDocument()
    expect(callsMatching('/categories', 'GET')).toHaveLength(2)
  })

  // CA-12: no restaurant → informative message and NO GET .../categories.
  it('shows the "create your restaurant first" message and never fetches categories', async () => {
    routeFetch([{ method: 'GET', match: '/restaurants', response: jsonResponse([]) }])

    render(<MenuEditorPage />)

    expect(await screen.findByText(/creá tu restaurante primero/i)).toBeInTheDocument()
    // The copy points the user at "Mi restaurante".
    expect(screen.getByText(/mi restaurante/i)).toBeInTheDocument()
    expect(callsMatching('/categories')).toHaveLength(0)
  })
})

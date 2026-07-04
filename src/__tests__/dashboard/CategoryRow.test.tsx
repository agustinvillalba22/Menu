import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryRow from '../../components/dashboard/CategoryRow'
import type { Category } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const category: Category = { id: 'c1', name: 'Entradas', type: 'food' }

function renderRow() {
  return render(
    <ul>
      <CategoryRow restaurantId="r1" category={category} onDeleted={vi.fn()} />
    </ul>,
  )
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('CategoryRow', () => {
  // CA-03: editing the name inline PATCHes only { name } (type is not resent).
  it('PATCHes only the changed name field', async () => {
    routeFetch([
      { method: 'PATCH', match: '/categories', response: jsonResponse({ ...category, name: 'Platos' }) },
    ])

    renderRow()

    await userEvent.click(screen.getByRole('button', { name: /editar/i }))
    const input = screen.getByLabelText(/nombre de la categoría/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'Platos')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    // Name updates in place.
    expect(await screen.findByText('Platos')).toBeInTheDocument()

    const patches = callsMatching('/categories', 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].url).toBe('http://api.test/restaurants/r1/categories/c1')
    expect(JSON.parse(patches[0].body as string)).toEqual({ name: 'Platos' })
  })

  // CA-05: subcategories load lazily, exactly once — collapse + re-expand reuses state.
  it('fetches subcategories only on the first expand, not on re-expand', async () => {
    routeFetch([
      { method: 'GET', match: '/subcategories', response: jsonResponse([]) },
      { method: 'PATCH', match: '/categories', response: jsonResponse(category) },
    ])

    renderRow()

    const toggle = screen.getByRole('button', { expanded: false })

    // First expand → triggers the GET; wait until the loaded tree is shown.
    await userEvent.click(toggle)
    expect(await screen.findByRole('button', { name: /agregar subcategoría/i })).toBeInTheDocument()
    expect(callsMatching('/subcategories', 'GET')).toHaveLength(1)

    // Collapse, then expand again → no new GET.
    await userEvent.click(screen.getByRole('button', { expanded: true }))
    await userEvent.click(screen.getByRole('button', { expanded: false }))

    expect(callsMatching('/subcategories', 'GET')).toHaveLength(1)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubcategoryRow from '../../components/dashboard/SubcategoryRow'
import type { Item, Subcategory } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const subcategory: Subcategory = { id: 's1', name: 'Fríos', category_id: 'c1' }

const createdItem: Item = {
  id: 'i1',
  name: 'Ceviche',
  description: '',
  price: '12.50',
  image_url: null,
  subcategory_id: 's1',
  tags: [],
}

function renderRow() {
  return render(
    <ul>
      <SubcategoryRow
        restaurantId="r1"
        categoryId="c1"
        subcategory={subcategory}
        onDeleted={vi.fn()}
      />
    </ul>,
  )
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('SubcategoryRow', () => {
  // CA-11: the "add item" form only exists inside an expanded subcategory.
  it('does not render the add-item form until expanded', async () => {
    routeFetch([{ method: 'GET', match: '/items', response: jsonResponse([]) }])

    renderRow()

    expect(screen.queryByRole('button', { name: /agregar ítem/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(await screen.findByRole('button', { name: /agregar ítem/i })).toBeInTheDocument()
  })

  // CA-06: creating an item sends price as a string and renders it as "$12.50".
  it('POSTs price as a string and shows the formatted price', async () => {
    routeFetch([
      { method: 'POST', match: '/items', response: jsonResponse(createdItem) },
      { method: 'GET', match: '/items', response: jsonResponse([]) },
    ])

    renderRow()

    await userEvent.click(screen.getByRole('button', { expanded: false }))
    await screen.findByRole('button', { name: /agregar ítem/i })

    await userEvent.type(screen.getByLabelText(/nombre del nuevo ítem/i), 'Ceviche')
    await userEvent.type(screen.getByLabelText(/precio del nuevo ítem/i), '12.50')
    await userEvent.click(screen.getByRole('button', { name: /agregar ítem/i }))

    // The item appears with the formatted price.
    expect(await screen.findByText('$12.50')).toBeInTheDocument()

    const posts = callsMatching('/items', 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe('http://api.test/restaurants/r1/subcategories/s1/items')
    // Raw body keeps price as a JSON string, never the number 12.5.
    expect(posts[0].body).toContain('"price":"12.50"')
    const parsed = JSON.parse(posts[0].body as string)
    expect(parsed).toEqual({ name: 'Ceviche', description: '', price: '12.50' })
    expect(typeof parsed.price).toBe('string')
  })

  // CA-01 / CA-03: deleting a subcategory requires inline confirmation that
  // mentions the cascade, and only DELETEs after the user confirms.
  it('shows a cascade delete confirmation and only DELETEs after confirming', async () => {
    routeFetch([{ method: 'DELETE', match: '/subcategories', response: jsonResponse(undefined, 204) }])
    const onDeleted = vi.fn()
    render(
      <ul>
        <SubcategoryRow
          restaurantId="r1"
          categoryId="c1"
          subcategory={subcategory}
          onDeleted={onDeleted}
        />
      </ul>,
    )

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))

    expect(callsMatching('/subcategories', 'DELETE')).toHaveLength(0)
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByText(/se borrará también todo lo que contiene/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))

    expect(callsMatching('/subcategories', 'DELETE')).toHaveLength(1)
    expect(onDeleted).toHaveBeenCalledWith('s1')
  })

  // CA-02: cancelling the confirmation never calls DELETE.
  it('cancelling the delete confirmation does not call DELETE', async () => {
    renderRow()

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(callsMatching('/subcategories', 'DELETE')).toHaveLength(0)
    expect(screen.getByText('Fríos')).toBeInTheDocument()
  })
})

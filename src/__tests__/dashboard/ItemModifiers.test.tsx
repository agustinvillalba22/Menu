import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ItemModifiers from '../../components/dashboard/ItemModifiers'
import type { Modifier } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const existing: Modifier = {
  id: 'm1',
  item_id: 'i1',
  name: 'Extra queso',
  price_delta: '1.50',
  type: 'extra',
}

function renderComponent() {
  return render(<ItemModifiers restaurantId="r1" subcategoryId="s1" itemId="i1" />)
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('ItemModifiers', () => {
  it('lists the existing modifiers', async () => {
    routeFetch([{ method: 'GET', match: '/modifiers', response: jsonResponse([existing]) }])

    renderComponent()

    expect(await screen.findByText('Extra queso')).toBeInTheDocument()
    expect(screen.getByText(/Extra, \+ \$1\.50/)).toBeInTheDocument()
  })

  it('creates a modifier and shows it', async () => {
    routeFetch([
      {
        method: 'POST',
        match: '/modifiers',
        response: jsonResponse({ id: 'm2', item_id: 'i1', name: 'Sin cebolla', price_delta: '-0.50', type: 'removal' }, 201),
      },
      { method: 'GET', match: '/modifiers', response: jsonResponse([]) },
    ])

    renderComponent()
    // Wait for the initial (empty) load to settle.
    expect(await screen.findByText(/sin modificadores/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/nombre del nuevo modificador/i), 'Sin cebolla')
    await userEvent.type(screen.getByLabelText(/precio del nuevo modificador/i), '-0.50')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    expect(await screen.findByText('Sin cebolla')).toBeInTheDocument()

    const posts = callsMatching('/modifiers', 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe('http://api.test/restaurants/r1/subcategories/s1/items/i1/modifiers')
    expect(JSON.parse(posts[0].body as string)).toEqual({
      name: 'Sin cebolla',
      price_delta: '-0.50',
      type: 'extra',
    })
  })

  it('edits a modifier via PATCH', async () => {
    routeFetch([
      {
        method: 'PATCH',
        match: '/modifiers/',
        response: jsonResponse({ ...existing, name: 'Extra muzza' }),
      },
      { method: 'GET', match: '/modifiers', response: jsonResponse([existing]) },
    ])

    renderComponent()
    await screen.findByText('Extra queso')

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const nameInput = screen.getByLabelText(/nombre del modificador/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Extra muzza')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Extra muzza')).toBeInTheDocument()

    const patches = callsMatching('/modifiers/', 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].url).toBe(
      'http://api.test/restaurants/r1/subcategories/s1/items/i1/modifiers/m1',
    )
    expect(JSON.parse(patches[0].body as string)).toEqual({ name: 'Extra muzza' })
  })

  it('deletes a modifier via DELETE', async () => {
    routeFetch([
      { method: 'DELETE', match: '/modifiers/', response: jsonResponse(undefined, 204) },
      { method: 'GET', match: '/modifiers', response: jsonResponse([existing]) },
    ])

    renderComponent()
    await screen.findByText('Extra queso')

    await userEvent.click(screen.getByRole('button', { name: /eliminar modificador extra queso/i }))

    await waitFor(() => expect(screen.queryByText('Extra queso')).not.toBeInTheDocument())

    const deletes = callsMatching('/modifiers/', 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].url).toBe(
      'http://api.test/restaurants/r1/subcategories/s1/items/i1/modifiers/m1',
    )
  })

  it('shows an error alert when loading modifiers fails', async () => {
    routeFetch([{ method: 'GET', match: '/modifiers', response: jsonResponse({ detail: 'boom' }, 500) }])

    renderComponent()

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar los modificadores/i)
  })
})

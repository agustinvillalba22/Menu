import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

function renderComponent(modifiers: Modifier[] = [], onModifiersChange = vi.fn()) {
  return {
    onModifiersChange,
    ...render(
      <ItemModifiers
        restaurantId="r1"
        subcategoryId="s1"
        itemId="i1"
        modifiers={modifiers}
        onModifiersChange={onModifiersChange}
      />,
    ),
  }
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('ItemModifiers', () => {
  it('lists the modifiers passed via props (no fetch on its own)', () => {
    renderComponent([existing])

    expect(screen.getByText('Extra queso')).toBeInTheDocument()
    expect(screen.getByText(/Extra, \+ \$1\.50/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows "sin modificadores" when the list prop is empty', () => {
    renderComponent([])

    expect(screen.getByText(/sin modificadores/i)).toBeInTheDocument()
  })

  it('creates a modifier, calls onModifiersChange with the appended item, and does not call listModifiers', async () => {
    routeFetch([
      {
        method: 'POST',
        match: '/modifiers',
        response: jsonResponse(
          { id: 'm2', item_id: 'i1', name: 'Sin cebolla', price_delta: '-0.50', type: 'removal' },
          201,
        ),
      },
    ])

    const { onModifiersChange } = renderComponent([])

    await userEvent.type(screen.getByLabelText(/nombre del nuevo modificador/i), 'Sin cebolla')
    await userEvent.type(screen.getByLabelText(/precio del nuevo modificador/i), '-0.50')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    await screen.findByRole('button', { name: /agregar/i })
    expect(screen.getByLabelText(/nombre del nuevo modificador/i)).toHaveValue('')
    expect(onModifiersChange).toHaveBeenCalledWith([
      { id: 'm2', item_id: 'i1', name: 'Sin cebolla', price_delta: '-0.50', type: 'removal' },
    ])

    const posts = callsMatching('/modifiers', 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe('http://api.test/restaurants/r1/subcategories/s1/items/i1/modifiers')
    expect(JSON.parse(posts[0].body as string)).toEqual({
      name: 'Sin cebolla',
      price_delta: '-0.50',
      type: 'extra',
    })
    expect(callsMatching('/modifiers', 'GET')).toHaveLength(0)
  })

  it('edits a modifier via PATCH and calls onModifiersChange with the updated array', async () => {
    routeFetch([
      {
        method: 'PATCH',
        match: '/modifiers/',
        response: jsonResponse({ ...existing, name: 'Extra muzza' }),
      },
    ])

    const { onModifiersChange } = renderComponent([existing])

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const nameInput = screen.getByLabelText(/nombre del modificador/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Extra muzza')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onModifiersChange).toHaveBeenCalledWith([{ ...existing, name: 'Extra muzza' }])

    const patches = callsMatching('/modifiers/', 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].url).toBe(
      'http://api.test/restaurants/r1/subcategories/s1/items/i1/modifiers/m1',
    )
    expect(JSON.parse(patches[0].body as string)).toEqual({ name: 'Extra muzza' })
    expect(callsMatching('/modifiers', 'GET')).toHaveLength(0)
  })

  it('deletes a modifier via DELETE and calls onModifiersChange with the filtered array', async () => {
    routeFetch([{ method: 'DELETE', match: '/modifiers/', response: jsonResponse(undefined, 204) }])

    const { onModifiersChange } = renderComponent([existing])

    await userEvent.click(screen.getByRole('button', { name: /eliminar modificador extra queso/i }))

    expect(onModifiersChange).toHaveBeenCalledWith([])

    const deletes = callsMatching('/modifiers/', 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].url).toBe(
      'http://api.test/restaurants/r1/subcategories/s1/items/i1/modifiers/m1',
    )
    expect(callsMatching('/modifiers', 'GET')).toHaveLength(0)
  })

  it('shows an error alert when adding a modifier fails, without touching the parent list', async () => {
    routeFetch([{ method: 'POST', match: '/modifiers', response: jsonResponse({ detail: 'boom' }, 500) }])

    const { onModifiersChange } = renderComponent([])

    await userEvent.type(screen.getByLabelText(/nombre del nuevo modificador/i), 'Sin cebolla')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    // ApiError propagates the server-provided detail as the message (existing
    // behavior of handleAdd's error handling, unrelated to this refactor).
    expect(await screen.findByRole('alert')).toHaveTextContent(/boom/i)
    expect(onModifiersChange).not.toHaveBeenCalled()
  })
})

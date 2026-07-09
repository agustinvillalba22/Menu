import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ItemRow from '../../components/dashboard/ItemRow'
import type { Item } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

// ItemImageUpload is exercised in its own test file. Here we mock it with a
// tiny stand-in so we can drive `onImageChange` and observe that ItemRow
// re-renders it with the new `imageUrl` from local state — no list refetch
// (CA-08 of the M10 spec).
vi.mock('../../components/dashboard/ItemImageUpload', () => ({
  default: ({
    imageUrl,
    onImageChange,
  }: {
    imageUrl: string | null
    onImageChange: (url: string | null) => void
  }) => (
    <div>
      <span data-testid="mock-image-url">{imageUrl ?? 'no-image'}</span>
      <button type="button" onClick={() => onImageChange('https://cdn.example.com/new.jpg')}>
        mock set image
      </button>
    </div>
  ),
}))

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const item: Item = {
  id: 'i1',
  name: 'Milanesa',
  description: 'con papas',
  price: '10.00',
  image_url: null,
  subcategory_id: 's1',
  tags: [
    { id: 't1', name: 'Sin TACC' },
    { id: 't2', name: 'Picante' },
  ],
}

const existingModifier = {
  id: 'm1',
  item_id: 'i1',
  name: 'Extra queso',
  price_delta: '1.50',
  type: 'extra' as const,
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

function renderRow(theItem: Item = item, onDeleted = vi.fn()) {
  return render(
    <ul>
      <ItemRow restaurantId="r1" subcategoryId="s1" item={theItem} onDeleted={onDeleted} />
    </ul>,
  )
}

describe('ItemRow', () => {
  // CA-01: deleting an item requires inline confirmation before the DELETE call.
  it('requires confirmation before DELETE, and calls onDeleted only after confirming', async () => {
    routeFetch([
      { method: 'DELETE', match: '/items', response: jsonResponse(undefined, 204) },
      { method: 'GET', match: '/modifiers', response: jsonResponse([]) },
    ])
    const onDeleted = vi.fn()
    renderRow(item, onDeleted)

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))
    expect(callsMatching('/items', 'DELETE')).toHaveLength(0)
    expect(onDeleted).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))

    expect(callsMatching('/items', 'DELETE')).toHaveLength(1)
    expect(onDeleted).toHaveBeenCalledWith('i1')
  })

  // CA-02: cancelling leaves the item intact and never calls DELETE.
  it('cancelling the delete confirmation leaves the row untouched', async () => {
    routeFetch([{ method: 'GET', match: '/modifiers', response: jsonResponse([]) }])
    const onDeleted = vi.fn()
    renderRow(item, onDeleted)

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(callsMatching('/items', 'DELETE')).toHaveLength(0)
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByText('Milanesa')).toBeInTheDocument()
  })

  // CA-04: tags and modifiers are collapsed by default — counts are visible,
  // names are not in the DOM until each toggle is expanded independently.
  it('renders tags and modifiers collapsed with counts, expanding each independently', async () => {
    routeFetch([
      {
        method: 'GET',
        match: '/modifiers',
        response: jsonResponse([{ id: 'm1', item_id: 'i1', name: 'Extra queso', price_delta: '1.50', type: 'extra' }]),
      },
    ])

    renderRow()

    // Counts are visible immediately without expanding.
    const tagsToggle = await screen.findByRole('button', { name: /tags \(2\)/i })
    const modifiersToggle = await screen.findByRole('button', { name: /modificadores \(1\)/i })
    expect(tagsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(modifiersToggle).toHaveAttribute('aria-expanded', 'false')

    // Tag/modifier names are not rendered until expanded. The tag chip itself
    // (as opposed to the curated dietary-tag picker) is identified by its
    // "Eliminar tag" remove button, which only exists once ItemTags mounts.
    expect(screen.queryByRole('button', { name: /eliminar tag sin tacc/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Extra queso')).not.toBeInTheDocument()

    await userEvent.click(tagsToggle)
    expect(tagsToggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      await screen.findByRole('button', { name: /eliminar tag sin tacc/i }),
    ).toBeInTheDocument()
    // Modifiers remain collapsed — independent toggles.
    expect(screen.queryByText('Extra queso')).not.toBeInTheDocument()

    await userEvent.click(modifiersToggle)
    expect(modifiersToggle).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('Extra queso')).toBeInTheDocument()
  })

  // CA-01 / RF-06: listModifiers is called exactly once, no matter how many
  // times the toggle is expanded/collapsed.
  it('calls listModifiers exactly once even when the toggle is expanded/collapsed 3 times', async () => {
    routeFetch([
      { method: 'GET', match: '/modifiers', response: jsonResponse([existingModifier]) },
    ])

    renderRow()

    const modifiersToggle = await screen.findByRole('button', { name: /modificadores \(1\)/i })

    await userEvent.click(modifiersToggle) // expand
    await userEvent.click(modifiersToggle) // collapse
    await userEvent.click(modifiersToggle) // expand
    await userEvent.click(modifiersToggle) // collapse
    await userEvent.click(modifiersToggle) // expand

    expect(callsMatching('/modifiers', 'GET')).toHaveLength(1)
  })

  // CA-02: expanding after the initial fetch resolved shows the list immediately,
  // with no additional loading state or network call.
  it('shows the list immediately when expanding after the initial fetch already resolved', async () => {
    routeFetch([
      { method: 'GET', match: '/modifiers', response: jsonResponse([existingModifier]) },
    ])

    renderRow()

    const modifiersToggle = await screen.findByRole('button', { name: /modificadores \(1\)/i })
    // Wait for the initial fetch to resolve (count reflects loaded data).
    await screen.findByRole('button', { name: /modificadores \(1\)/i })

    await userEvent.click(modifiersToggle)

    expect(screen.queryByText(/cargando modificadores/i)).not.toBeInTheDocument()
    expect(await screen.findByText('Extra queso')).toBeInTheDocument()
    expect(callsMatching('/modifiers', 'GET')).toHaveLength(1)
  })

  // CA-05: if the toggle is expanded before the initial fetch resolves, a
  // loading message is shown instead of the modifiers list.
  it('shows "Cargando modificadores…" when expanded before the initial fetch resolves', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    renderRow()

    const modifiersToggle = await screen.findByRole('button', { name: /modificadores \(0\)/i })
    await userEvent.click(modifiersToggle)

    expect(screen.getByText(/cargando modificadores/i)).toBeInTheDocument()
    expect(screen.queryByText('Extra queso')).not.toBeInTheDocument()

    resolveFetch(jsonResponse([existingModifier]))

    expect(await screen.findByText('Extra queso')).toBeInTheDocument()
    expect(screen.queryByText(/cargando modificadores/i)).not.toBeInTheDocument()
  })

  // CA-04: an item with no tags/modifiers still shows "(0)", the toggle isn't hidden.
  it('shows "(0)" toggles for an item without tags or modifiers', async () => {
    routeFetch([{ method: 'GET', match: '/modifiers', response: jsonResponse([]) }])

    renderRow({ ...item, tags: [] })

    expect(await screen.findByRole('button', { name: /tags \(0\)/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /modificadores \(0\)/i })).toBeInTheDocument()
  })

  // CA-08 (M10): ItemRow reflects the updated image_url via onImageChange,
  // straight from local state, with no refetch of the items list.
  it('reflects the new image_url from onImageChange without refetching the item list', async () => {
    routeFetch([{ method: 'GET', match: '/modifiers', response: jsonResponse([]) }])

    renderRow(item)

    // Passes the item's current image_url (null) down to ItemImageUpload.
    expect(screen.getByTestId('mock-image-url')).toHaveTextContent('no-image')

    await userEvent.click(screen.getByRole('button', { name: /mock set image/i }))

    // Local `current.image_url` updated and re-passed to the child.
    expect(screen.getByTestId('mock-image-url')).toHaveTextContent(
      'https://cdn.example.com/new.jpg',
    )
    // No GET to the items list (the pre-existing eager /modifiers fetch is
    // expected and excluded here — it's unrelated to image state).
    const itemsListGets = callsMatching('/items', 'GET').filter(
      (call) => !call.url.includes('/modifiers'),
    )
    expect(itemsListGets).toHaveLength(0)
  })

  // CA-06: the item-level "Borrar" uses the same classes as category/subcategory.
  it('renders "Borrar" with the same red/medium-weight classes as the shared RowActions', async () => {
    routeFetch([{ method: 'GET', match: '/modifiers', response: jsonResponse([]) }])
    renderRow()

    const deleteButton = screen.getByRole('button', { name: /^borrar$/i })
    expect(deleteButton.className).toBe(
      'text-xs font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50',
    )
  })
})

import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ItemTags from '../../components/dashboard/ItemTags'
import type { Tag } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

/** Controlled harness: ItemTags renders from the `tags` prop, so a parent must
 *  own the list to observe the visible update after add/remove. */
function Harness({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(initialTags)
  return (
    <ItemTags
      restaurantId="r1"
      subcategoryId="s1"
      itemId="i1"
      tags={tags}
      onTagsChange={setTags}
    />
  )
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('ItemTags', () => {
  // CA-07: adding a tag POSTs { name } and appends the returned tag —
  // regardless of whether the backend answered 201 (new) or 200 (existing).
  it.each([201, 200])('adds the returned tag on a %i response', async (status) => {
    routeFetch([
      { method: 'POST', match: '/tags', response: jsonResponse({ id: 't1', name: 'vegano' }, status) },
    ])

    render(<Harness initialTags={[]} />)

    await userEvent.type(screen.getByLabelText(/nuevo tag/i), 'vegano')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    expect(await screen.findByText('vegano')).toBeInTheDocument()

    const posts = callsMatching('/tags', 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe('http://api.test/restaurants/r1/subcategories/s1/items/i1/tags')
    expect(JSON.parse(posts[0].body as string)).toEqual({ name: 'vegano' })
  })

  // CA-07 (no dup): a returned tag whose id already shows is not duplicated.
  it('does not duplicate a tag that is already in the list', async () => {
    routeFetch([
      { method: 'POST', match: '/tags', response: jsonResponse({ id: 't1', name: 'vegano' }) },
    ])

    render(<Harness initialTags={[{ id: 't1', name: 'vegano' }]} />)

    await userEvent.type(screen.getByLabelText(/nuevo tag/i), 'vegano')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    await waitFor(() => expect(callsMatching('/tags', 'POST')).toHaveLength(1))
    expect(screen.getAllByText('vegano')).toHaveLength(1)
  })

  // CA-08: clicking "x" DELETEs the tag and removes it from the visible list.
  it('removes a tag after a successful DELETE', async () => {
    routeFetch([
      { method: 'DELETE', match: '/tags', response: jsonResponse(undefined, 204) },
    ])

    render(<Harness initialTags={[{ id: 't1', name: 'vegano' }]} />)

    await userEvent.click(screen.getByRole('button', { name: /eliminar tag vegano/i }))

    await waitFor(() => expect(screen.queryByText('vegano')).not.toBeInTheDocument())

    const deletes = callsMatching('/tags', 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].url).toBe('http://api.test/restaurants/r1/subcategories/s1/items/i1/tags/t1')
  })

  // CA-03: with no tags, all 5 curated chips render inactive; clicking
  // "Vegano" adds the tag (exact canonical name) and the chip flips active.
  it('shows the 5 curated chips inactive and activates one on click', async () => {
    routeFetch([
      { method: 'POST', match: '/tags', response: jsonResponse({ id: 't1', name: 'Vegano' }) },
    ])

    render(<Harness initialTags={[]} />)

    for (const name of ['Sin TACC', 'Sin lácteos', 'Vegetariano', 'Vegano', 'Picante']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    }

    await userEvent.click(screen.getByRole('button', { name: 'Vegano' }))

    const posts = callsMatching('/tags', 'POST')
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0].body as string)).toEqual({ name: 'Vegano' })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Vegano' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })

  // CA-04: with "Vegano" already active (case-insensitive match against
  // current.tags), clicking again removes it via the delete flow.
  it('deactivates an already-active curated chip on second click', async () => {
    routeFetch([
      { method: 'DELETE', match: '/tags', response: jsonResponse(undefined, 204) },
    ])

    render(<Harness initialTags={[{ id: 't1', name: 'vegano' }]} />)

    const chip = screen.getByRole('button', { name: 'Vegano' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(chip)

    const deletes = callsMatching('/tags', 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].url).toBe('http://api.test/restaurants/r1/subcategories/s1/items/i1/tags/t1')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Vegano' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    )
  })
})

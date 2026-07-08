import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicMenuPage from '../../pages/public/PublicMenuPage'
import type { PublicMenuResponse } from '../../lib/types'
import { jsonResponse } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
})

/** Menu fixture with two items in the same subcategory, to exercise the product grid. */
const menu: PublicMenuResponse = {
  restaurant: { name: 'Boulette', slug: 'boulette', orders_enabled: false },
  style: null,
  categories: [
    {
      id: 'c1',
      name: 'Pizzas',
      type: 'food',
      subcategories: [
        {
          id: 's1',
          name: 'Clásicas',
          items: [
            {
              id: 'i1',
              name: 'Margherita',
              description: 'Tomate y mozzarella',
              price: '12.50',
              image_url: null,
              tags: [],
              modifiers: [],
            },
            {
              id: 'i2',
              name: 'Napolitana',
              description: 'Tomate, mozzarella y ajo',
              price: '13.50',
              image_url: null,
              tags: [],
              modifiers: [],
            },
          ],
        },
      ],
    },
  ],
}

function renderMenu(token = 'valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/menu/${token}`]}>
      <Routes>
        <Route path="/menu/:qrToken" element={<PublicMenuPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicMenuPage — desktop layout (CA-02/CA-03)', () => {
  // CA-03: the outer content wrapper is no longer hard-capped at mobile's max-w-md;
  // it must carry a wider desktop max-width utility (e.g. max-w-6xl) alongside it.
  it('the main content wrapper grows beyond max-w-md on desktop breakpoints', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    const { container } = renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    const wrapper = container.querySelector('.mx-auto') as HTMLElement
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.className).toMatch(/max-w-md/)
    // A wider desktop max-width utility must also be present (lg:/xl: prefixed).
    expect(wrapper.className).toMatch(/lg:max-w-(4xl|5xl|6xl|7xl)/)
  })

  // CA-02: subcategories with more than one item render in a Tailwind grid that
  // expands to multiple columns at lg/xl, instead of staying a single mobile column.
  it('renders the product grid with lg/xl multi-column breakpoint classes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    const margherita = await screen.findByText('Margherita')
    const grid = margherita.closest('.grid') as HTMLElement
    expect(grid).toBeInTheDocument()
    expect(grid.className).toMatch(/grid-cols-1/)
    expect(grid.className).toMatch(/lg:grid-cols-2/)
    expect(grid.className).toMatch(/xl:grid-cols-3/)
  })
})

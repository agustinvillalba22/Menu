import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicMenuPage from '../../pages/public/PublicMenuPage'
import type { PublicMenuResponse } from '../../lib/types'
import { errorResponse, jsonResponse } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  // Guard for the isolation tests: start each case with a clean root element.
  document.documentElement.style.removeProperty('--color-primario')
  document.documentElement.style.removeProperty('--color-secundario')
})

const menu: PublicMenuResponse = {
  restaurant: { name: 'Boulette', slug: 'boulette', orders_enabled: false },
  style: { font_family: 'Playfair Display', primary_color: '#112233', secondary_color: '#445566' },
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
              tags: [{ id: 't1', name: 'Vegetariana' }],
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

describe('PublicMenuPage', () => {
  // CA-05: valid qrToken, no auth cookie → renders the full menu tree, no redirect.
  it('renders the full menu tree for a valid token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    renderMenu()

    expect(await screen.findByRole('heading', { name: 'Boulette', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pizzas', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clásicas', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Margherita')).toBeInTheDocument()
    expect(screen.getByText('Tomate y mozzarella')).toBeInTheDocument()
    expect(screen.getByText('$12.50')).toBeInTheDocument()
    expect(screen.getByText('Vegetariana')).toBeInTheDocument()
  })

  it('calls the public endpoint without special auth handling', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    renderMenu('abc123')

    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('http://api.test/menu/abc123')
  })

  // CA-06: invalid/unknown token → "menú no encontrado", not a blank screen.
  it('shows a not-found state when the backend returns 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse('menu_not_found', 404))

    renderMenu('nope')

    expect(await screen.findByRole('heading', { name: /menú no encontrado/i })).toBeInTheDocument()
  })

  it('shows a generic error state on a non-404 failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse('boom', 500))

    renderMenu()

    expect(await screen.findByText(/no se pudo cargar el menú/i)).toBeInTheDocument()
  })

  // CA-07: theming lives on a LOCAL wrapper, never on document.documentElement.
  it('sets the theme CSS vars on the local wrapper only', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    const { container } = renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--color-primario')).toBe('#112233')
    expect(wrapper.style.getPropertyValue('--color-secundario')).toBe('#445566')
    expect(wrapper.style.getPropertyValue('--font-heading')).toBe('Playfair Display')

    // The core assertion of the whole spec: the root element is untouched.
    expect(document.documentElement.style.getPropertyValue('--color-primario')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--color-secundario')).toBe('')
  })

  // CA-08: leaving the menu route leaves no theming residue behind.
  it('leaves document.documentElement clean after unmount', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    const { unmount } = renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(document.documentElement.style.getPropertyValue('--color-primario')).toBe('')

    unmount()

    expect(document.documentElement.style.getPropertyValue('--color-primario')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toBe('')
  })

  // RF-10: style === null (legacy restaurant) → renders with defaults, no crash,
  // no CSS var overrides on the wrapper.
  it('renders with defaults when style is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...menu, style: null }))

    const { container } = renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.getPropertyValue('--color-primario')).toBe('')
    expect(wrapper.style.getPropertyValue('--font-heading')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--color-primario')).toBe('')
  })
})

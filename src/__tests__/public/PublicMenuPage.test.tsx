import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  restaurant: {
    name: 'Boulette',
    slug: 'boulette',
    orders_enabled: false,
    address: '',
    phone: '',
    logo_url: null,
    timezone: '',
    business_hours: [],
    is_open_now: false,
    whatsapp_enabled: false,
  },
  style: { font_family: 'Playfair Display', primary_color: '#112233', secondary_color: '#445566' },
  promo: null,
  categories: [
    {
      id: 'c1',
      name: 'Pizzas',
      type: 'food',
      icon: 'pizza',
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

  // P8: a category with `icon` set renders a Lucide icon (svg) inside its
  // filter chip; the "Todo" chip (icon: null) and any text-only chip render
  // no leading svg.
  it('renders the category icon inside the filter chip when set', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    const { container } = renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    // The Pizzas chip carries `icon: 'pizza'` in the fixture; Lucia renders
    // an <svg>, so the chip for "Pizzas" has one and the "Todo" chip has none.
    const pizzasChip = screen.getByRole('button', { name: /pizzas/i }) as HTMLElement
    const todoChip = screen.getByRole('button', { name: /^todo$/i }) as HTMLElement
    expect(pizzasChip.querySelector('svg')).not.toBeNull()
    expect(todoChip.querySelector('svg')).toBeNull()

    // Sanity belt: the rendered svg actually uses the Lucide Pizza shape —
    // lucide icons set `class="lucide lucide-pizza"` on the root <svg>.
    expect(pizzasChip.querySelector('svg.lucide-pizza')).not.toBeNull()
    // The container is unused otherwise but kept to mirror the other tests'
    // pattern of grabbing it for future assertions.
    expect(container).toBeInTheDocument()
  })

  // P6 — header local-info block: when the owner has set business_hours the
  // open/closed pill renders with the server-computed is_open_now, and the
  // schedule summary condenses consecutive same-window weekdays ("Lun-Vie
  // 09-18"). When the restaurant is brand new (no address/phone/hours/logo)
  // the block stays hidden and the header keeps its original shape.
  it('renders the open/closed pill and schedule summary when hours are set', async () => {
    const withInfo: PublicMenuResponse = {
      ...menu,
      restaurant: {
        ...menu.restaurant,
        name: 'Bodegón Don Pepe',
        address: 'Av. Corrientes 1234',
        phone: '11 1234-5678',
        logo_url: 'https://cdn.test/logo.png',
        business_hours: [
          { weekday: 0, open_time: '09:00:00', close_time: '18:00:00' },
          { weekday: 1, open_time: '09:00:00', close_time: '18:00:00' },
          { weekday: 2, open_time: '09:00:00', close_time: '18:00:00' },
          { weekday: 3, open_time: '09:00:00', close_time: '18:00:00' },
          { weekday: 4, open_time: '09:00:00', close_time: '18:00:00' },
          { weekday: 5, open_time: '11:00:00', close_time: '23:30:00' },
        ],
        is_open_now: true,
      },
    }

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(withInfo))

    renderMenu()

    // Pill is labeled via aria-label so it's accessible-friendly regardless
    // of the visible text wrapping.
    expect(await screen.findByLabelText(/local abierto|abierto ahora/i)).toBeInTheDocument()

    // The schedule summary appears as one truncated string with the grouped
    // Mon-Fri run condensed.
    expect(screen.getByText(/Lun-Vie 09:00-18:00/)).toBeInTheDocument()
    expect(screen.getByText(/Sáb 11:00-23:30/)).toBeInTheDocument()

    // Address + phone chips render with their text.
    expect(screen.getByText('Av. Corrientes 1234')).toBeInTheDocument()
    expect(screen.getByText('11 1234-5678')).toBeInTheDocument()

    // Logo on the heading row.
    const logo = screen.getByAltText(/logo de bodegón don pepe/i) as HTMLImageElement
    expect(logo.src).toBe('https://cdn.test/logo.png')
  })

  // The complement: an empty-info restaurant (default fixture) keeps the
  // info block hidden so the header renders as before P6.
  it('hides the local-info block when the restaurant has no info set', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    expect(screen.queryByLabelText(/local abierto|cerrado/i)).not.toBeInTheDocument()
    expect(screen.queryByAltText(/logo de/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// P4 (Fase 2c) — active promo banner
// ---------------------------------------------------------------------------

describe('PublicMenuPage — promo banner', () => {
  const withPromo: PublicMenuResponse = {
    ...menu,
    promo: {
      id: 'p1',
      title: '2x1 Pizzas',
      subtitle: 'Solo hoy',
      description: 'Pide el plato del día y llevá la segunda gratis',
      discount_pct: 50,
      image_url: 'https://cdn.test/promo.jpg',
      item_id: 'i1', // Margherita
    },
  }

  it('renders the server-resolved promo banner with the discount headline', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(withPromo))

    renderMenu()

    expect(await screen.findByTestId('promo-banner')).toBeInTheDocument()
    expect(screen.getByText('50% OFF')).toBeInTheDocument()
    expect(screen.getByText('Solo hoy')).toBeInTheDocument()
    expect(
      screen.getByText('Pide el plato del día y llevá la segunda gratis'),
    ).toBeInTheDocument()
    const img = screen.getByAltText('2x1 Pizzas') as HTMLImageElement
    expect(img.src).toBe('https://cdn.test/promo.jpg')
  })

  it('opens the linked item modal when the banner is clicked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(withPromo))

    renderMenu()
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()

    await userEvent.click(await screen.findByTestId('promo-banner'))

    // The linked item (i1 = Margherita) opens its detail modal — ordering is
    // disabled in this fixture, so assert via the modal's close button.
    expect(await screen.findByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('renders the promo title as headline when there is no discount', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ ...withPromo, promo: { ...withPromo.promo!, discount_pct: null } }),
    )

    renderMenu()

    expect(await screen.findByText('2x1 Pizzas', { selector: '[data-testid="promo-banner"] *' })).toBeInTheDocument()
    expect(screen.queryByText('50% OFF')).not.toBeInTheDocument()
  })

  it('renders no banner when the promo is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(menu))

    renderMenu()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })

    expect(screen.queryByTestId('promo-banner')).not.toBeInTheDocument()
  })
})

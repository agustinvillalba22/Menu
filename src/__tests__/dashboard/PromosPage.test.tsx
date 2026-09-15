import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PromosPage from '../../pages/dashboard/PromosPage'
import type { Promo, Restaurant } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const restaurant: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: true,
  role: 'owner',
}

function promoFixture(overrides: Partial<Promo> = {}): Promo {
  return {
    id: 'p1',
    restaurant_id: 'r1',
    title: '2x1 Pizzas',
    subtitle: 'Solo hoy',
    description: null,
    discount_pct: 50,
    image_url: null,
    scope: 'none',
    item_id: null,
    category_id: null,
    is_active: true,
    starts_at: null,
    ends_at: null,
    days_remaining: null,
    ...overrides,
  }
}

/** Default routes: my-restaurant + empty categories (skips the item chain).
 *
 * Order matters: routeFetch matches by url-substring with first-match-wins,
 * and '/restaurants/r1/promos' contains '/restaurants' — so the specific
 * promo/category routes must be declared BEFORE the my-restaurant one.
 */
function baseRoutes(promos: Promo[]) {
  return [
    { method: 'GET', match: '/promos', response: jsonResponse(promos) },
    { method: 'GET', match: '/categories', response: jsonResponse([]) },
    { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
  ]
}

function fetchCalls() {
  return vi.mocked(fetch).mock.calls.map((c) => readCall(c as [unknown, unknown]))
}

describe('PromosPage', () => {
  it('renders the promo list with active state and no expiry badge', async () => {
    routeFetch(baseRoutes([promoFixture()]))

    render(<PromosPage />)

    expect(await screen.findByText('2x1 Pizzas')).toBeInTheDocument()
    expect(screen.getByText('50% OFF')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    // No ends_at -> no days badge, no expiry notice.
    expect(screen.queryByTestId('promo-days-p1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('promo-expiry-notice')).not.toBeInTheDocument()
  })

  // P5: days_remaining is rendered as a badge; <=3 days on an active promo
  // also triggers the dismissible notice banner.
  it('shows the expiry badge and notice when a promo expires soon', async () => {
    routeFetch(baseRoutes([promoFixture({ days_remaining: 2 })]))

    render(<PromosPage />)

    expect(await screen.findByTestId('promo-days-p1')).toHaveTextContent('Vence en 2d')
    const notice = await screen.findByTestId('promo-expiry-notice')
    expect(notice).toHaveTextContent(/vence en 2 día/i)
    expect(notice).toHaveTextContent('2x1 Pizzas')
  })

  it('shows Vence hoy for a 0-days promo and no notice for far expiry', async () => {
    routeFetch(baseRoutes([promoFixture({ id: 'p0', days_remaining: 0 })]))

    render(<PromosPage />)

    expect(await screen.findByTestId('promo-days-p0')).toHaveTextContent('Vence hoy')
    expect(screen.getByTestId('promo-expiry-notice')).toBeInTheDocument()
  })

  it('renders no notice for an inactive promo expiring soon', async () => {
    routeFetch(baseRoutes([promoFixture({ is_active: false, days_remaining: 1 })]))

    render(<PromosPage />)

    await screen.findByText('2x1 Pizzas')
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
    expect(screen.queryByTestId('promo-expiry-notice')).not.toBeInTheDocument()
  })

  it('POSTs the create payload with ISO datetimes and discount', async () => {
    routeFetch([
      ...baseRoutes([]),
      { method: 'POST', match: '/promos', response: jsonResponse(promoFixture(), 201) },
    ])

    render(<PromosPage />)
    await userEvent.click(await screen.findByRole('button', { name: /nueva promo/i }))

    await userEvent.type(screen.getByLabelText(/título \*/i), '2x1 Pizzas')
    await userEvent.type(screen.getByLabelText(/descuento \(%\)/i), '50')
    // datetime-local value as the browser produces it (local tz).
    await userEvent.type(
      screen.getByLabelText(/vigencia desde/i),
      '2026-09-14T21:00',
    )
    // Active checkbox.
    await userEvent.click(screen.getByLabelText(/activa/i))

    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))

    const posts = fetchCalls().filter((c) => c.method === 'POST' && c.url.includes('/promos'))
    expect(posts).toHaveLength(1)
    const body = JSON.parse(posts[0].body as string)
    expect(body.title).toBe('2x1 Pizzas')
    expect(body.discount_pct).toBe(50)
    expect(body.is_active).toBe(true)
    // '' -> null, '2026-09-14T21:00' -> aware ISO.
    expect(body.item_id).toBeNull()
    expect(body.starts_at).toMatch(/^2026-09-1[45]T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(body.ends_at).toBeNull()
  })

  it('PATCHes only is_active on the toggle button', async () => {
    routeFetch([
      ...baseRoutes([promoFixture()]),
      {
        method: 'PATCH',
        match: '/promos/p1',
        response: jsonResponse(promoFixture({ is_active: false })),
      },
    ])

    render(<PromosPage />)
    await userEvent.click(await screen.findByRole('button', { name: /pausar/i }))

    const patches = fetchCalls().filter(
      (c) => c.method === 'PATCH' && c.url.includes('/promos/p1'),
    )
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0].body as string)).toEqual({ is_active: false })
  })

  it('deletes a promo after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    routeFetch([
      ...baseRoutes([promoFixture()]),
      { method: 'DELETE', match: '/promos/p1', response: jsonResponse(null, 204) },
    ])

    render(<PromosPage />)
    await userEvent.click(await screen.findByRole('button', { name: /eliminar 2x1 pizzas/i }))

    const deletes = fetchCalls().filter(
      (c) => c.method === 'DELETE' && c.url.includes('/promos/p1'),
    )
    expect(deletes).toHaveLength(1)
    confirmSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Fase 0010 — scope selector in the create form
// ---------------------------------------------------------------------------

describe('PromosPage — discount scope', () => {
  it('POSTs scope=catalog with the discount, no item/category links', async () => {
    routeFetch([
      ...baseRoutes([]),
      { method: 'POST', match: '/promos', response: jsonResponse(promoFixture(), 201) },
    ])

    render(<PromosPage />)
    await userEvent.click(await screen.findByRole('button', { name: /nueva promo/i }))

    await userEvent.type(screen.getByLabelText(/título \*/i), 'Happy hour')
    await userEvent.type(screen.getByLabelText(/descuento \(%\)/i), '20')
    await userEvent.selectOptions(
      screen.getByLabelText(/alcance del descuento/i),
      'catalog',
    )
    // scope=catalog shows neither the item nor the category select.
    expect(screen.queryByLabelText(/^producto \*/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^categoría \*/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))

    const posts = fetchCalls().filter((c) => c.method === 'POST' && c.url.includes('/promos'))
    const body = JSON.parse(posts[0].body as string)
    expect(body.scope).toBe('catalog')
    expect(body.discount_pct).toBe(20)
    expect(body.item_id).toBeNull()
    expect(body.category_id).toBeNull()
  })

  it('shows the category select only for scope=category and validates it', async () => {
    const catList = [
      {
        id: 'cat-1',
        name: 'Pizzas',
        type: 'food' as const,
        icon: null,
        subcategories: [],
      },
    ]
    routeFetch([
      { method: 'GET', match: '/promos', response: jsonResponse([]) },
      { method: 'GET', match: '/categories', response: jsonResponse(catList) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<PromosPage />)
    await userEvent.click(await screen.findByRole('button', { name: /nueva promo/i }))

    await userEvent.type(screen.getByLabelText(/título \*/i), 'Pizzas 20%')
    await userEvent.type(screen.getByLabelText(/descuento \(%\)/i), '20')
    await userEvent.selectOptions(
      screen.getByLabelText(/alcance del descuento/i),
      'category',
    )

    // Category select appeared; pick one and POST.
    const catSelect = await screen.findByLabelText(/^categoría \*/i)
    await userEvent.selectOptions(catSelect, 'cat-1')

    // Re-route for the POST + reload.
    routeFetch([
      {
        method: 'POST',
        match: '/promos',
        response: jsonResponse(
          promoFixture({ scope: 'category', category_id: 'cat-1', discount_pct: 20 }),
          201,
        ),
      },
      { method: 'GET', match: '/promos', response: jsonResponse([]) },
      { method: 'GET', match: '/categories', response: jsonResponse(catList) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))

    const posts = fetchCalls().filter((c) => c.method === 'POST' && c.url.includes('/promos'))
    expect(posts).toHaveLength(1)
    const body = JSON.parse(posts[0].body as string)
    expect(body.scope).toBe('category')
    expect(body.category_id).toBe('cat-1')
  })

  it('refuses to save scope=item without a discount percentage', async () => {
    routeFetch([
      ...baseRoutes([]),
      { method: 'POST', match: '/promos', response: jsonResponse(promoFixture(), 201) },
    ])

    render(<PromosPage />)
    await userEvent.click(await screen.findByRole('button', { name: /nueva promo/i }))

    await userEvent.type(screen.getByLabelText(/título \*/i), 'Sin pct')
    await userEvent.selectOptions(
      screen.getByLabelText(/alcance del descuento/i),
      'catalog',
    )
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/porcentaje de descuento/i)
    const posts = fetchCalls().filter((c) => c.method === 'POST' && c.url.includes('/promos'))
    expect(posts).toHaveLength(0)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import OverviewPage from '../../pages/dashboard/OverviewPage'
import type { Restaurant } from '../../lib/types'
import { jsonResponse, readCall } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const restaurant: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: false,
  role: 'owner',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OverviewPage />
    </MemoryRouter>,
  )
}

describe('OverviewPage', () => {
  // CA-01: authenticated user with no restaurants → sees the create form.
  it('shows the create form when the user has no restaurant', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]))

    renderPage()

    expect(await screen.findByLabelText(/nombre del restaurante/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear restaurante/i })).toBeInTheDocument()
  })

  // CA-03: user with an existing restaurant → sees its data, not the form.
  it('shows the restaurant data (and no create form) when one exists', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([restaurant]))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Boulette' })).toBeInTheDocument()
    expect(screen.getByText('boulette')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: '/menu/qr-abc' })
    expect(link).toHaveAttribute('href', '/menu/qr-abc')
    expect(screen.queryByLabelText(/nombre del restaurante/i)).not.toBeInTheDocument()
  })

  // CA-02: after creating, the page shows the new restaurant without a manual reload.
  it('shows the newly created restaurant after submitting the form', async () => {
    let created = false
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'POST') {
        created = true
        return jsonResponse(restaurant)
      }
      // GET /restaurants: empty until the POST has happened.
      return jsonResponse(created ? [restaurant] : [])
    })

    renderPage()

    const input = await screen.findByLabelText(/nombre del restaurante/i)
    await userEvent.type(input, 'Boulette')
    await userEvent.click(screen.getByRole('button', { name: /crear restaurante/i }))

    expect(await screen.findByRole('heading', { name: 'Boulette' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '/menu/qr-abc' })).toBeInTheDocument()

    // The POST body carried the entered name.
    const postCall = vi.mocked(fetch).mock.calls.find(
      (c) => ((c[1] as RequestInit)?.method ?? 'GET').toUpperCase() === 'POST',
    )
    expect(postCall).toBeDefined()
    expect((postCall![1] as RequestInit).body).toBe(JSON.stringify({ name: 'Boulette' }))
  })

  it('shows an error state when listing restaurants fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'boom' }, 500))

    renderPage()

    // Wait for the loading text to disappear, then the alert is shown.
    await waitForElementToBeRemoved(() => screen.queryByText(/cargando/i))
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i)
  })

  // M11: owner toggles `orders_enabled` from the overview.
  it('toggles orders_enabled and PATCHes the restaurant with the new value', async () => {
    let enabled = false
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'PATCH') {
        enabled = true
        return jsonResponse({ ...restaurant, orders_enabled: true })
      }
      // GET /restaurants reflects the current toggle state.
      return jsonResponse([{ ...restaurant, orders_enabled: enabled }])
    })

    renderPage()

    const toggle = await screen.findByRole('switch', { name: /recepción de pedidos/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(toggle)

    // Success feedback + the switch now reads as on.
    expect(await screen.findByRole('status')).toHaveTextContent(/preferencia de pedidos guardada/i)
    expect(screen.getByRole('switch', { name: /recepción de pedidos/i })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // The PATCH carried the restaurant name plus the new orders_enabled flag.
    const patchCall = vi.mocked(fetch).mock.calls
      .map((c) => readCall(c as [unknown, unknown]))
      .find((c) => c.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(patchCall!.url).toBe('http://api.test/restaurants/r1')
    expect(JSON.parse(patchCall!.body as string)).toEqual({
      name: 'Boulette',
      orders_enabled: true,
    })
  })

  it('shows an error when saving the orders preference fails', async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'PATCH') {
        return jsonResponse({ detail: 'boom' }, 500)
      }
      return jsonResponse([restaurant])
    })

    renderPage()

    const toggle = await screen.findByRole('switch', { name: /recepción de pedidos/i })
    await userEvent.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo guardar la preferencia/i)
    expect(screen.getByRole('switch', { name: /recepción de pedidos/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})

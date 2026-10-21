import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RestaurantInfoPage from '../../pages/dashboard/RestaurantInfoPage'
import type { Restaurant, RestaurantInfo } from '../../lib/types'
import { errorResponse, jsonResponse, readCall, routeFetch } from '../helpers'

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

const info: RestaurantInfo = {
  address: '',
  phone: '',
  whatsapp_phone: null,
  logo_url: null,
  timezone: '',
  business_hours: [
    { weekday: 0, open_time: '09:00:00', close_time: '18:00:00' },
    { weekday: 4, open_time: '11:00:00', close_time: '23:30:00' },
  ],
  is_open_now: true,
}

function patchInfoCalls() {
  return vi
    .mocked(fetch)
    .mock.calls
    .map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.method === 'PATCH' && c.url.includes('/info'))
}

function putHoursCalls() {
  return vi
    .mocked(fetch)
    .mock.calls
    .map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.method === 'PUT' && c.url.includes('/business-hours'))
}

/** Waits until GET /info has landed (weekday 0 comes back enabled). The page
 * renders its form with empty defaults for one commit before the load effect
 * flips `loading` on (form -> "Cargando…" -> form), so a `findBy*` alone can
 * resolve on a transient, soon-unmounted form. Callers re-query afterwards. */
async function infoLoaded(): Promise<void> {
  await waitFor(() => expect(screen.getAllByRole('checkbox')[0]).toBeChecked())
}

describe('RestaurantInfoPage', () => {
  beforeEach(() => {
    // Default route set so any uncatched fetch throws loudly (mirrors the
    // AppearancePage.test.tsx pattern).
    routeFetch([
      // GET /info on mount (and again after save-hundreds refetch).
      { method: 'GET', match: '/info', response: jsonResponse(info) },
      // GET /restaurants (useMyRestaurant).
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
  })

  // CA-01: the page opens with the loaded info — the address input carries
  // the restaurant's saved value, and the hours grid reflects enabled days
  // (Mon=09-18, Fri=11-23:30) vs the untouched Tue/Wed/... rows.
  it('renders the loaded hours as enabled rows', async () => {
    render(<RestaurantInfoPage />)

    await infoLoaded()
    const mondayOpen = (await screen.findByLabelText('Desde', { selector: '#open-0' })) as HTMLInputElement
    expect(mondayOpen.value).toBe('09:00')
    const mondayClose = screen.getByLabelText('Hasta', { selector: '#close-0' }) as HTMLInputElement
    expect(mondayClose.value).toBe('18:00')

    // Friday should be enabled and 11-23:30 → time inputs rounded to 23:30.
    const fridayOpen = screen.getByLabelText('Desde', { selector: '#open-4' }) as HTMLInputElement
    expect(fridayOpen.value).toBe('11:00')
    // Tuesday row is not enabled → no `open-1` rendered at all.
    expect(screen.queryByLabelText('Desde', { selector: '#open-1' })).not.toBeInTheDocument()
  })

  // CA-02: PATCHing only the address sends `{address}` and shows the success banner.
  it('PATCHes only the modified field on the contact form', async () => {
    // First GET loads the empty-info fixture (address="") so the user-typed
    // value becomes the whole input value; PATCH echoes the new address back.
    routeFetch([
      { method: 'GET', match: '/info', response: jsonResponse(info) },
      {
        method: 'PATCH',
        match: '/info',
        response: jsonResponse({ ...info, address: 'Av. X 123' }),
      },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<RestaurantInfoPage />)
    await screen.findByLabelText(/dirección/i)
    await infoLoaded()
    const addressInput = screen.getByLabelText(/dirección/i) as HTMLInputElement
    await userEvent.type(addressInput, 'Av. X 123')
    await userEvent.click(await screen.findByRole('button', { name: /guardar información/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/guardada/i)
    const patches = patchInfoCalls()
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0].body as string)).toEqual({ address: 'Av. X 123' })
  })

  // CA-03: invalid whatsapp_phone (backend 422 with empty string sent) → error shown.
  it('shows the server-side whatsapp_phone validation error as a form alert', async () => {
    routeFetch([
      {
        method: 'PATCH',
        match: '/info',
        response: jsonResponse({ detail: [{ msg: 'whatsapp_phone must be 6-15 digits' }] }, 422),
      },
      { method: 'GET', match: '/info', response: jsonResponse(info) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<RestaurantInfoPage />)
    await screen.findByLabelText(/whatsapp/i)
    await infoLoaded()
    await userEvent.type(screen.getByLabelText(/whatsapp/i), 'bad')
    await userEvent.click(await screen.findByRole('button', { name: /guardar información/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  // CA-04: Save Horarios sends a PUT with only the enabled rows.
  it('PUTs only the enabled hours on Save', async () => {
    routeFetch([
      {
        method: 'PUT',
        match: '/business-hours',
        response: jsonResponse([
          { weekday: 0, open_time: '09:00:00', close_time: '18:00:00' },
        ]),
      },
      { method: 'GET', match: '/info', response: jsonResponse(info) },
      { method: 'GET', match: '/info', response: jsonResponse({ ...info, business_hours: [{ weekday: 0, open_time: '09:00:00', close_time: '18:00:00' }] }) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<RestaurantInfoPage />)
    // First GET /info lands → the page is interactive.
    await screen.findByLabelText(/dirección/i)
    await infoLoaded()

    // Disable Friday by toggling its checkbox off; then save.
    const fridayCheckbox = screen.getAllByRole('checkbox')[4]
    await userEvent.click(fridayCheckbox)
    await userEvent.click(await screen.findByRole('button', { name: /guardar horarios/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
    const puts = putHoursCalls()
    expect(puts).toHaveLength(1)
    expect(JSON.parse(puts[0].body as string)).toEqual({
      hours: [
        { weekday: 0, open_time: '09:00:00', close_time: '18:00:00' },
      ],
    })
  })

  // M15 CA-05: PATCH /info, PUT /business-hours and the logo endpoints are
  // owner-only on the backend — an editor sees every mutation control
  // disabled/hidden with an explanation, but current data stays visible.
  it('disables the info, hours and logo controls for an editor while keeping current data visible', async () => {
    routeFetch([
      { method: 'GET', match: '/info', response: jsonResponse(info) },
      {
        method: 'GET',
        match: '/restaurants',
        response: jsonResponse([{ ...restaurant, role: 'editor' }]),
      },
    ])

    render(<RestaurantInfoPage />)

    await screen.findByLabelText(/dirección/i)
    await infoLoaded()
    expect(screen.getByLabelText(/dirección/i)).toBeDisabled()
    expect(screen.getByLabelText(/teléfono/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /guardar información/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /guardar horarios/i })).toBeDisabled()
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled()

    // Current business hours are still rendered, not hidden (settled above).
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked() // weekday 0, from `info`

    // Logo uploader shows the explanation instead of an upload action.
    expect(screen.queryByRole('button', { name: /subir logo/i })).not.toBeInTheDocument()
    expect(
      screen.getAllByText(/solo el administrador del restaurante puede modificar/i).length,
    ).toBeGreaterThan(0)
  })

  // M15 CA-06: an owner sees every control enabled, same as today.
  it('keeps the info, hours and logo controls enabled for an owner', async () => {
    render(<RestaurantInfoPage />)

    await screen.findByLabelText(/dirección/i)
    await infoLoaded()
    expect(screen.getByLabelText(/dirección/i)).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /guardar información/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /guardar horarios/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /subir logo/i })).toBeInTheDocument()
  })

  // M25 CA-01: once the restaurant resolves but GET /info is pending, the
  // form must never be on screen (not even for one transient commit).
  it('shows "Cargando…" and never the form while GET /info is pending', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/info')) return new Promise<Response>(() => {})
      return jsonResponse([restaurant])
    })

    const { container } = render(<RestaurantInfoPage />)
    let formEverSeen = false
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (n instanceof Element && (n.matches('#address') || n.querySelector('#address'))) {
            formEverSeen = true
          }
        })
      }
    })
    observer.observe(container, { childList: true, subtree: true })

    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]).includes('/info'))).toBe(true),
    )
    await new Promise((r) => setTimeout(r, 20))
    observer.disconnect()

    expect(screen.getByText(/cargando…/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/dirección/i)).toBeNull()
    expect(formEverSeen).toBe(false)
  })

  // M25 CA-02: no restaurant -> create-restaurant message, not "Cargando…".
  it('shows the create-restaurant message when the user has no restaurant', async () => {
    routeFetch([{ method: 'GET', match: '/restaurants', response: jsonResponse([]) }])

    render(<RestaurantInfoPage />)

    expect(await screen.findByText(/creá tu restaurante primero/i)).toBeInTheDocument()
    expect(screen.queryByText(/cargando…/i)).toBeNull()
  })

  // M25 CA-03: a rejected GET /info surfaces the alert, not a stuck "Cargando…".
  it('shows an error alert when GET /info fails', async () => {
    routeFetch([
      { method: 'GET', match: '/info', response: errorResponse('boom', 500) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<RestaurantInfoPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/cargando…/i)).toBeNull()
    expect(screen.queryByLabelText(/dirección/i)).toBeNull()
  })
})

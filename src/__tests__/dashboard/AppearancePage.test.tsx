import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppearancePage from '../../pages/dashboard/AppearancePage'
import type { Restaurant, Style } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

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

const style: Style = {
  font_family: 'Inter',
  primary_color: '#000000',
  secondary_color: '#ffe0e0',
}

/** Finds the recorded PATCH fetch call, or fails if there is none. */
function patchCall() {
  const call = vi
    .mocked(fetch)
    .mock.calls.find((c) => ((c[1] as RequestInit)?.method ?? 'GET').toUpperCase() === 'PATCH')
  expect(call).toBeDefined()
  return readCall(call as [unknown, unknown])
}

describe('AppearancePage', () => {
  // CA-04: saving after changing only primary_color must PATCH with just that
  // field — unchanged font_family / secondary_color must not be resent.
  it('PATCHes only the modified fields', async () => {
    routeFetch([
      // Same secondary_color/font echoed back on save.
      { method: 'PATCH', match: '/style', response: jsonResponse({ ...style, primary_color: '#112233' }) },
      { method: 'GET', match: '/style', response: jsonResponse(style) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<AppearancePage />)

    const primary = (await screen.findByLabelText(/color primario/i)) as HTMLInputElement
    fireEvent.change(primary, { target: { value: '#112233' } })

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    // Success feedback confirms the request resolved.
    expect(await screen.findByRole('status')).toHaveTextContent(/guardados/i)

    const call = patchCall()
    expect(call.url).toBe('http://api.test/restaurants/r1/style')
    expect(JSON.parse(call.body as string)).toEqual({ primary_color: '#112233' })
  })

  it('includes multiple fields when several change', async () => {
    routeFetch([
      { method: 'PATCH', match: '/style', response: jsonResponse(style) },
      { method: 'GET', match: '/style', response: jsonResponse(style) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<AppearancePage />)

    const primary = (await screen.findByLabelText(/color primario/i)) as HTMLInputElement
    fireEvent.change(primary, { target: { value: '#112233' } })
    await userEvent.selectOptions(screen.getByLabelText(/tipografía/i), 'Poppins')

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await screen.findByRole('status')

    expect(JSON.parse(patchCall().body as string)).toEqual({
      font_family: 'Poppins',
      primary_color: '#112233',
    })
  })

  it('shows an error state when the update fails', async () => {
    routeFetch([
      { method: 'PATCH', match: '/style', response: jsonResponse({ detail: 'boom' }, 500) },
      { method: 'GET', match: '/style', response: jsonResponse(style) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<AppearancePage />)

    const primary = (await screen.findByLabelText(/color primario/i)) as HTMLInputElement
    fireEvent.change(primary, { target: { value: '#112233' } })
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron guardar/i)
  })

  // Fase 1b (P1): clicking a preset card fills all three channels and, on
  // save, PATCHes only the ones that actually differ from the loaded style.
  // "Clásico" shares font + secondary with the loaded style but differs on
  // primary, so the body must carry only `primary_color` (no spurious
  // secondary diff from the uppercase preset hex either — the page lowercases).
  it('clicking a preset PATCHes only the channels that differ', async () => {
    routeFetch([
      {
        method: 'PATCH',
        match: '/style',
        // server echoes back the new primary; secondary stays as loaded
        response: jsonResponse({ ...style, primary_color: '#fc462f' }),
      },
      { method: 'GET', match: '/style', response: jsonResponse(style) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<AppearancePage />)

    // Wait for the existing primary input to surface (proves the load landed).
    await screen.findByLabelText(/color primario/i)

    const clasico = await screen.findByRole('button', { name: /clásico/i })
    await userEvent.click(clasico)

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await screen.findByRole('status')

    expect(JSON.parse(patchCall().body as string)).toEqual({ primary_color: '#fc462f' })
  })

  // Switching to a preset that touches all three channels PATCHes all three.
  it('clicking a preset that changes all three PATCHes every field', async () => {
    routeFetch([
      {
        method: 'PATCH',
        match: '/style',
        response: jsonResponse({
          font_family: 'DM Sans',
          primary_color: '#111827',
          secondary_color: '#fbbf24',
        }),
      },
      { method: 'GET', match: '/style', response: jsonResponse(style) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<AppearancePage />)

    await screen.findByLabelText(/color primario/i)
    const elegante = await screen.findByRole('button', { name: /elegante/i })
    await userEvent.click(elegante)

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await screen.findByRole('status')

    expect(JSON.parse(patchCall().body as string)).toEqual({
      font_family: 'DM Sans',
      primary_color: '#111827',
      secondary_color: '#fbbf24',
    })
  })

  // M15 CA-04: PATCH /style is owner-only on the backend — an editor sees
  // the form disabled, but the current values stay visible.
  it('disables the style form for an editor while keeping current values visible', async () => {
    routeFetch([
      { method: 'GET', match: '/style', response: jsonResponse(style) },
      {
        method: 'GET',
        match: '/restaurants',
        response: jsonResponse([{ ...restaurant, role: 'editor' }]),
      },
    ])

    render(<AppearancePage />)

    const primary = (await screen.findByLabelText(/color primario/i)) as HTMLInputElement
    expect(primary).toBeDisabled()
    // The field's value settles in a state update shortly after it first
    // appears (same latent race as RestaurantInfoPage, M17) — wait for it
    // explicitly instead of racing it.
    await waitFor(() => expect(primary.value).toBe('#000000'))
    expect(screen.getByLabelText(/tipografía/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
    expect(
      screen.getByText(/solo el administrador del restaurante puede modificar la apariencia/i),
    ).toBeInTheDocument()
  })

  // M15 CA-06: an owner sees the form enabled, same as today.
  it('keeps the style form enabled for an owner', async () => {
    routeFetch([
      { method: 'GET', match: '/style', response: jsonResponse(style) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<AppearancePage />)

    const primary = await screen.findByLabelText(/color primario/i)
    expect(primary).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled()
  })
})

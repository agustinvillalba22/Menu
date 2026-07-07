import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
})

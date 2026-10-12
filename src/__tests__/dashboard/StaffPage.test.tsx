import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffPage from '../../pages/dashboard/StaffPage'
import type { Restaurant, StaffMember } from '../../lib/types'
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

const member: StaffMember = { id: 's1', name: 'Juan', position: 'mozo', pin: '1234', active: true }

describe('StaffPage', () => {
  it('renders the roster with position and PIN', async () => {
    routeFetch([
      { method: 'GET', match: '/staff', response: jsonResponse([member]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ])

    render(<StaffPage />)

    expect(await screen.findByText('Juan')).toBeInTheDocument()
    expect(screen.getByText(/mozo · pin 1234/i)).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  // CA-01/CA-05: creating a staff member POSTs name/position/pin and lists it.
  it('creates a staff member', async () => {
    routeFetch([
      { method: 'GET', match: '/staff', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      {
        method: 'POST',
        match: '/staff',
        response: jsonResponse({ id: 's9', name: 'Ana', position: 'cajero', pin: '9999', active: true }, 201),
      },
    ])

    render(<StaffPage />)
    await screen.findByText('Todavía no cargaste a nadie del equipo.')

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Ana')
    await userEvent.selectOptions(screen.getByLabelText(/puesto/i), 'cajero')
    await userEvent.type(screen.getByLabelText(/pin/i), '9999')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    expect(await screen.findByText('Ana')).toBeInTheDocument()
    const post = vi
      .mocked(fetch)
      .mock.calls.map((c) => readCall(c as [unknown, unknown]))
      .find((c) => c.method === 'POST')
    expect(JSON.parse(post!.body as string)).toEqual({ name: 'Ana', position: 'cajero', pin: '9999' })
  })

  // CA-01 (duplicate PIN) — surfaces the 409 as a friendly message.
  it('shows a friendly error when the PIN is already taken', async () => {
    routeFetch([
      { method: 'GET', match: '/staff', response: jsonResponse([]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      { method: 'POST', match: '/staff', response: jsonResponse({ detail: 'pin_taken' }, 409) },
    ])

    render(<StaffPage />)
    await screen.findByText('Todavía no cargaste a nadie del equipo.')

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Ana')
    await userEvent.type(screen.getByLabelText(/pin/i), '1234')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    expect(await screen.findByText(/ya existe alguien con ese pin/i)).toBeInTheDocument()
  })

  // RNF-02 guard: toggling active status does not block/alter the rest of the page.
  it('toggles active status', async () => {
    routeFetch([
      { method: 'GET', match: '/staff', response: jsonResponse([member]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      {
        method: 'PATCH',
        match: '/staff/s1',
        response: jsonResponse({ ...member, active: false }),
      },
    ])

    render(<StaffPage />)
    await screen.findByText('Juan')

    await userEvent.click(screen.getByRole('button', { name: 'Activo' }))

    expect(await screen.findByRole('button', { name: 'Inactivo' })).toBeInTheDocument()
  })

  it('deletes a staff member after confirming', async () => {
    routeFetch([
      { method: 'GET', match: '/staff', response: jsonResponse([member]) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
      { method: 'DELETE', match: '/staff/s1', response: jsonResponse(null, 204) },
    ])

    render(<StaffPage />)
    await screen.findByText('Juan')

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))
    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))

    expect(screen.queryByText('Juan')).not.toBeInTheDocument()
  })
})

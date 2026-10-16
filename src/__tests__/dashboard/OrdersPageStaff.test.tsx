import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import OrdersPage from '../../pages/dashboard/OrdersPage'
import type { OrderRead, Restaurant, StaffMember } from '../../lib/types'
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

const ana: StaffMember = { id: 's1', name: 'Ana', position: 'mozo', pin: '1111', active: true }
const luis: StaffMember = { id: 's2', name: 'Luis', position: 'mozo', pin: '2222', active: false }

const order: OrderRead = {
  id: 'o1',
  restaurant_id: 'r1',
  status: 'pending',
  customer_name: 'Juan Pérez',
  order_type: 'mesa',
  table_or_address: 'Mesa 4',
  table_id: null,
  notes: null,
  total: '10.00',
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
  whatsapp_url: null,
  handled_by_id: null,
  handled_by_name: null,
  cash_shift_id: null,
  items: [],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>,
  )
}

function patches() {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.method === 'PATCH')
}

describe('OrdersPage staff attribution (M28)', () => {
  it('shows the Atiende selector with only active staff and a Sin asignar option', async () => {
    routeFetch([
      { match: '/staff', response: jsonResponse([ana, luis]) },
      { match: '/orders', response: jsonResponse([order]) },
      { match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    renderPage()

    const select = await screen.findByLabelText('Atiende')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument())
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Luis' })).not.toBeInTheDocument()
    expect(select).toHaveValue('')
  })

  it('sends staff_member_id in the PATCH when a person is selected', async () => {
    routeFetch([
      { method: 'PATCH', match: '/orders/', response: jsonResponse({ ...order, status: 'accepted' }) },
      { match: '/staff', response: jsonResponse([ana]) },
      { match: '/orders', response: jsonResponse([order]) },
      { match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    renderPage()
    await screen.findByText('Juan Pérez')
    await screen.findByRole('option', { name: 'Ana' })

    await userEvent.selectOptions(screen.getByLabelText('Atiende'), 'Ana')
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))

    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0].body as string)).toEqual({
      status: 'accepted',
      staff_member_id: 's1',
    })
  })

  it('omits staff_member_id when Sin asignar is selected', async () => {
    routeFetch([
      { method: 'PATCH', match: '/orders/', response: jsonResponse({ ...order, status: 'accepted' }) },
      { match: '/staff', response: jsonResponse([ana]) },
      { match: '/orders', response: jsonResponse([order]) },
      { match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    renderPage()
    await screen.findByRole('option', { name: 'Ana' })
    await screen.findByText('Juan Pérez')

    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))

    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0].body as string)).toEqual({ status: 'accepted' })
  })

  it('hides the selector and sends no staff field when there is no active staff', async () => {
    routeFetch([
      { method: 'PATCH', match: '/orders/', response: jsonResponse({ ...order, status: 'accepted' }) },
      { match: '/staff', response: jsonResponse([luis]) },
      { match: '/orders', response: jsonResponse([order]) },
      { match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    renderPage()
    await screen.findByText('Juan Pérez')

    expect(screen.queryByLabelText('Atiende')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0].body as string)).toEqual({ status: 'accepted' })
  })

  it('does not block the page when loading staff fails', async () => {
    routeFetch([
      { match: '/staff', response: jsonResponse({ detail: 'boom' }, 500) },
      { match: '/orders', response: jsonResponse([order]) },
      { match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    renderPage()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.queryByLabelText('Atiende')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows "Atendió: X" on orders that have handled_by_name only', async () => {
    const handled: OrderRead = { ...order, id: 'o2', customer_name: 'María', handled_by_name: 'Ana' }
    routeFetch([
      { match: '/staff', response: jsonResponse([]) },
      { match: '/orders', response: jsonResponse([order, handled]) },
      { match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    renderPage()

    await screen.findByText('María')
    expect(screen.getAllByText(/Atendió:/)).toHaveLength(1)
    expect(screen.getByText('Atendió: Ana')).toBeInTheDocument()
  })
})

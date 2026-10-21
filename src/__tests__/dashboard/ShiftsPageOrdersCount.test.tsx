import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ShiftsPage from '../../pages/dashboard/ShiftsPage'
import * as shifts from '../../lib/shifts'
import type { CashShift, Restaurant, StaffMember } from '../../lib/types'
import { jsonResponse, routeFetch } from '../helpers'

vi.mock('../../lib/shifts')
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
const ana: StaffMember = { id: 's1', name: 'Ana', position: 'cajero', pin: '1111', active: true }

const base: CashShift = {
  id: 'sh1',
  opened_by_name: 'Ana',
  opened_at: '2026-10-13T10:00:00Z',
  opening_amount: '100.00',
  closed_by_name: null,
  closed_at: null,
  counted_amount: null,
  expected_amount: null,
  difference: null,
  notes: null,
  orders_count: 3,
}

function setup(current: CashShift | null, history: CashShift[]): void {
  routeFetch([
    { match: '/staff', response: jsonResponse([ana]) },
    { match: '/restaurants', response: jsonResponse([restaurant]) },
  ])
  vi.mocked(shifts.getCurrentShift).mockResolvedValue(current)
  vi.mocked(shifts.listShifts).mockResolvedValue(history)
}

function renderPage(): void {
  render(
    <MemoryRouter>
      <ShiftsPage />
    </MemoryRouter>,
  )
}

describe('ShiftsPage orders_count (M28)', () => {
  it('shows N pedidos on the open shift', async () => {
    setup(base, [])
    renderPage()
    expect(await screen.findByText('3 pedidos')).toBeInTheDocument()
  })

  it('uses singular for one order', async () => {
    setup({ ...base, orders_count: 1 }, [])
    renderPage()
    expect(await screen.findByText('1 pedido')).toBeInTheDocument()
  })

  it('shows N pedidos in each history row', async () => {
    const closed = (id: string, n: number): CashShift => ({
      ...base,
      id,
      closed_at: '2026-10-13T18:00:00Z',
      closed_by_name: 'Ana',
      expected_amount: '150.00',
      counted_amount: '150.00',
      difference: '0.00',
      orders_count: n,
    })
    setup(null, [closed('a', 5), closed('b', 0)])
    renderPage()
    expect(await screen.findByText('5 pedidos')).toBeInTheDocument()
    expect(screen.getByText('0 pedidos')).toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ShiftsPage from '../../pages/dashboard/ShiftsPage'
import * as shifts from '../../lib/shifts'
import { ApiError } from '../../lib/api'
import type { CashShift, Restaurant, StaffMember } from '../../lib/types'
import { jsonResponse, routeFetch } from '../helpers'

vi.mock('../../lib/shifts')

global.fetch = vi.fn()

const restaurant: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: true,
  role: 'owner',
}

const ana: StaffMember = { id: 's1', name: 'Ana', position: 'cajero', pin: '1111', active: true }
const luis: StaffMember = { id: 's2', name: 'Luis', position: 'mozo', pin: '2222', active: false }

const openShiftData: CashShift = {
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
}

function closed(id: string, expected: string, counted: string, difference: string): CashShift {
  return {
    ...openShiftData,
    id,
    closed_by_name: 'Ana',
    closed_at: '2026-10-13T18:00:00Z',
    expected_amount: expected,
    counted_amount: counted,
    difference,
  }
}

function setup(opts: { staff?: StaffMember[]; current?: CashShift | null; history?: CashShift[] }): void {
  routeFetch([
    { method: 'GET', match: '/staff', response: jsonResponse(opts.staff ?? [ana, luis]) },
    { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
  ])
  vi.mocked(shifts.getCurrentShift).mockResolvedValue(opts.current ?? null)
  vi.mocked(shifts.listShifts).mockResolvedValue(opts.history ?? [])
}

function renderPage(): void {
  render(
    <MemoryRouter>
      <ShiftsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ShiftsPage', () => {
  it('shows the open form with only active staff when there is no open shift', async () => {
    setup({})
    renderPage()

    expect(await screen.findByRole('button', { name: 'Abrir turno' })).toBeInTheDocument()
    const select = screen.getByLabelText('Responsable')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument())
    expect(select).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Luis' })).not.toBeInTheDocument()
  })

  // CA-09: open a shift.
  it('opens a shift with the chosen staff and amount', async () => {
    setup({})
    vi.mocked(shifts.openShift).mockResolvedValue(openShiftData)
    renderPage()
    const user = userEvent.setup()

    await screen.findByRole('option', { name: 'Ana' })
    await user.type(screen.getByLabelText('Monto inicial'), '100')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    await waitFor(() =>
      expect(shifts.openShift).toHaveBeenCalledWith('r1', {
        staff_member_id: 's1',
        opening_amount: '100',
        notes: null,
      }),
    )
    expect(await screen.findByRole('button', { name: 'Cerrar turno' })).toBeInTheDocument()
  })

  it('renders the open shift card with who opened it and the opening amount', async () => {
    setup({ current: openShiftData })
    renderPage()

    expect(await screen.findByText(/Abierto por Ana/)).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).not.toBeInTheDocument()
  })

  // CA-09: close with arqueo; shows expected / counted / difference.
  it('closes the shift and shows expected, counted and difference', async () => {
    setup({ current: openShiftData })
    vi.mocked(shifts.closeShift).mockResolvedValue(closed('sh1', '180.00', '170.00', '-10.00'))
    renderPage()
    const user = userEvent.setup()

    await screen.findByRole('button', { name: 'Cerrar turno' })
    await screen.findByRole('option', { name: 'Ana' })
    await user.type(screen.getByLabelText('Monto contado'), '170')
    await user.click(screen.getByRole('button', { name: 'Cerrar turno' }))

    await waitFor(() =>
      expect(shifts.closeShift).toHaveBeenCalledWith('r1', 'sh1', {
        staff_member_id: 's1',
        counted_amount: '170',
        notes: null,
      }),
    )
    const result = await screen.findByTestId('close-result')
    expect(result).toHaveTextContent('Esperado')
    expect(result).toHaveTextContent('$180.00')
    expect(result).toHaveTextContent('Contado')
    expect(result).toHaveTextContent('$170.00')
    expect(result).toHaveTextContent('-$10.00')
    expect(await screen.findByRole('button', { name: 'Abrir turno' })).toBeInTheDocument()
  })

  // CA-09: history with colored difference.
  it('colors the difference: zero neutral, shortage red, surplus amber', async () => {
    setup({
      history: [
        closed('h1', '100.00', '100.00', '0.00'),
        closed('h2', '100.00', '90.00', '-10.00'),
        closed('h3', '100.00', '105.00', '5.00'),
      ],
    })
    renderPage()

    const zero = await screen.findByTestId('difference-h1')
    expect(zero).toHaveTextContent('$0.00')
    expect(zero.className).not.toMatch(/red|amber/)
    const short = screen.getByTestId('difference-h2')
    expect(short).toHaveTextContent('-$10.00')
    expect(short.className).toMatch(/red/)
    const surplus = screen.getByTestId('difference-h3')
    expect(surplus).toHaveTextContent('+$5.00')
    expect(surplus.className).toMatch(/amber/)
  })

  it('shows an empty history message', async () => {
    setup({})
    renderPage()
    expect(await screen.findByText('Todavía no hay turnos cerrados.')).toBeInTheDocument()
  })

  // CA-10: no active staff.
  it('warns and blocks opening when there is no active staff', async () => {
    setup({ staff: [luis] })
    renderPage()

    expect(await screen.findByText(/no hay personal activo/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /equipo/i })).toHaveAttribute('href', '/dashboard/staff')
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).not.toBeInTheDocument()
  })

  it('shows a conflict message when the shift was already opened', async () => {
    setup({})
    vi.mocked(shifts.openShift).mockRejectedValue(new ApiError(409, 'shift_already_open'))
    renderPage()
    const user = userEvent.setup()

    await screen.findByRole('option', { name: 'Ana' })
    await user.type(screen.getByLabelText('Monto inicial'), '50')
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya hay un turno abierto/i)
  })

  it('shows a load error', async () => {
    setup({})
    vi.mocked(shifts.getCurrentShift).mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar')
  })
})

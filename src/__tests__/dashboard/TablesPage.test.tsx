import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TablesPage from '../../pages/dashboard/TablesPage'
import type { OrderRead, Restaurant, TableOccupancy } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

const { toDataURLMock, toCanvasMock } = vi.hoisted(() => ({
  toDataURLMock: vi.fn(),
  toCanvasMock: vi.fn(),
}))
vi.mock('qrcode', () => ({ default: { toDataURL: toDataURLMock, toCanvas: toCanvasMock } }))

global.fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  toDataURLMock.mockResolvedValue('data:image/png;base64,AAAA')
  toCanvasMock.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

const restaurant: Restaurant = {
  id: 'r1', name: 'Boulette', slug: 'boulette', qr_token: 'qr-abc', orders_enabled: true, role: 'owner',
}

function order(over: Partial<OrderRead> = {}): OrderRead {
  return {
    id: 'o1', restaurant_id: 'r1', status: 'pending', customer_name: 'Ana', order_type: 'mesa',
    table_or_address: 'Mesa 1', table_id: 't1', notes: 'Sin sal general', total: '37000.00',
    created_at: '2026-01-01T12:00:00Z', updated_at: '2026-01-01T12:00:00Z', whatsapp_url: null,
    handled_by_id: null, handled_by_name: null, cash_shift_id: null, payment_method: 'cash',
    payment_status: 'none', payment_url: null,
    items: [{
      id: 'i1', item_id: 'm1', name_snapshot: 'Tagliatelle', unit_price_snapshot: '18500.00',
      discount_pct: null, quantity: 2, special_instructions: 'Sin pimienta', subtotal: '37000.00',
      modifiers: [{ id: 'mo1', name_snapshot: 'Extra queso', price_snapshot: '0.00', type: 'extra' }],
    }],
    ...over,
  } as OrderRead
}

const free = (id: string, number: number, capacity: number | null = 2): TableOccupancy => ({
  id, number, capacity, status: 'free', total: '0.00', first_order_at: null, bill_requested_at: null, orders: [],
})
const occupied: TableOccupancy = {
  id: 't1', number: 1, capacity: 4, status: 'occupied', total: '37000.00',
  first_order_at: new Date(Date.now() - 25 * 60000).toISOString(), bill_requested_at: null, orders: [order()],
}
const bill: TableOccupancy = { ...occupied, id: 't3', number: 3, status: 'bill', bill_requested_at: new Date().toISOString() }

function setup(list: TableOccupancy[], extra: Parameters<typeof routeFetch>[0] = []): void {
  routeFetch([
    { method: 'GET', match: '/tables/occupancy', response: jsonResponse(list) },
    { method: 'GET', match: '/staff', response: jsonResponse([]) },
    { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
    ...extra,
  ])
}

describe('TablesPage', () => {
  it('muestra tarjetas por estado con badge, pax, consumo y tiempo, y leyenda con conteos', async () => {
    setup([occupied, free('t2', 2, null), bill])
    render(<TablesPage />)
    const card1 = (await screen.findByRole('button', { name: /mesa 1/i }))
    expect(card1).toHaveTextContent('Ocupada')
    expect(card1).toHaveTextContent('4 pax')
    expect(card1).toHaveTextContent('$37.000,00')
    expect(card1).toHaveTextContent('hace 25 min')
    const card2 = screen.getByRole('button', { name: /mesa 2/i })
    expect(card2).toHaveTextContent('Libre')
    expect(card2).not.toHaveTextContent('pax')
    expect(screen.getByRole('button', { name: /mesa 3/i })).toHaveTextContent('Cuenta')
    const legend = screen.getByRole('list', { name: 'Leyenda' })
    expect(legend).toHaveTextContent('Libre (1)')
    expect(legend).toHaveTextContent('Ocupada (1)')
    expect(legend).toHaveTextContent('Cuenta (1)')
  })

  it('muestra placeholder y, al seleccionar, el detalle con líneas, notas y total', async () => {
    setup([occupied])
    render(<TablesPage />)
    expect(await screen.findByText('Seleccioná una mesa')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /mesa 1/i }))
    expect(screen.getByRole('button', { name: /mesa 1/i })).toHaveAttribute('aria-pressed', 'true')
    const panel = screen.getByRole('complementary', { name: /detalle/i })
    expect(within(panel).getByText(/2× Tagliatelle/)).toBeInTheDocument()
    expect(within(panel).getByText('Extra queso')).toBeInTheDocument()
    expect(within(panel).getByText('Nota: Sin pimienta')).toBeInTheDocument()
    expect(within(panel).getByText('Nota: Sin sal general')).toBeInTheDocument()
    expect(within(panel).getByText('Total: $37.000,00')).toBeInTheDocument()
  })

  it('refresca al volver la pestaña a visible', async () => {
    setup([occupied])
    render(<TablesPage />)
    await screen.findByRole('button', { name: /mesa 1/i })
    const gets = () => vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).includes('/tables/occupancy')).length
    const before = gets()
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(gets()).toBeGreaterThan(before))
  })

  it('Pedir cuenta llama al endpoint y pasa a Cuenta; queda deshabilitado', async () => {
    setup([occupied], [{ method: 'POST', match: '/t1/bill-request', response: jsonResponse({ ...occupied, status: 'bill', bill_requested_at: new Date().toISOString() }) }])
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 1/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Pedir cuenta' }))
    expect(await screen.findByRole('button', { name: 'Cuenta pedida' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /mesa 1/i })).toHaveTextContent('Cuenta')
  })

  it('Pedir cuenta y Cobrar están deshabilitados en mesa libre', async () => {
    setup([free('t2', 2)])
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 2/i }))
    expect(screen.getByRole('button', { name: 'Pedir cuenta' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cobrar y liberar' })).toBeDisabled()
  })

  it('Cobrar y liberar exige confirmación y deja la mesa Libre', async () => {
    setup([occupied], [{ method: 'POST', match: '/t1/checkout', response: jsonResponse(free('t1', 1, 4)) }])
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 1/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar y liberar' }))
    const posts = () => vi.mocked(fetch).mock.calls.map((c) => readCall(c as [unknown, unknown])).filter((c) => c.method === 'POST')
    expect(posts()).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: /sí, cobrar/i }))
    expect(await screen.findByText('La mesa no tiene pedidos activos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mesa 1/i })).toHaveTextContent('Libre')
    expect(posts()).toHaveLength(1)
  })

  it('muestra mensaje ante 409 table_not_occupied', async () => {
    setup([occupied], [{ method: 'POST', match: '/t1/checkout', response: jsonResponse({ detail: 'table_not_occupied' }, 409) }])
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 1/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar y liberar' }))
    await userEvent.click(screen.getByRole('button', { name: /sí, cobrar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La mesa ya no tiene pedidos activos')
  })

  it('Cargar nuevo pedido abre el menú con la mesa y noopener', async () => {
    setup([occupied])
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 1/i }))
    await userEvent.click(screen.getByRole('button', { name: /cargar nuevo pedido/i }))
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/menu/qr-abc?mesa=1`, '_blank', 'noopener')
  })

  it('el botón QR muestra el QR de la mesa con la URL correcta', async () => {
    setup([occupied])
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 1/i }))
    await userEvent.click(screen.getByRole('button', { name: 'QR' }))
    expect(await screen.findByAltText('Código QR del menú')).toBeInTheDocument()
    expect(toDataURLMock).toHaveBeenCalledWith(`${window.location.origin}/menu/qr-abc?mesa=1`, expect.anything())
    expect(screen.getByRole('button', { name: /descargar qr/i })).toBeInTheDocument()
  })

  it('Descargar todos genera un único mesas-qr.png', async () => {
    setup([occupied, free('t2', 2)])
    const ctx = { fillRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,BBBB')
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar todos' }))
    await vi.waitFor(() => expect(names).toEqual(['mesas-qr.png']))
    expect(toCanvasMock).toHaveBeenCalledTimes(2)
    expect(ctx.fillText).toHaveBeenCalledWith('Mesa 2', expect.any(Number), expect.any(Number))
  })

  it('sin mesas no aparece Descargar todos', async () => {
    setup([])
    render(<TablesPage />)
    await screen.findByText('Todavía no cargaste ninguna mesa.')
    expect(screen.queryByRole('button', { name: 'Descargar todos' })).not.toBeInTheDocument()
  })

  it('crea una mesa y la lista como Libre', async () => {
    setup([], [{ method: 'POST', match: '/tables', response: jsonResponse({ id: 't9', number: 5, capacity: 6 }, 201) }])
    render(<TablesPage />)
    await screen.findByText('Todavía no cargaste ninguna mesa.')
    await userEvent.type(screen.getByLabelText(/número/i), '5')
    await userEvent.type(screen.getByLabelText(/capacidad/i), '6')
    await userEvent.click(screen.getByRole('button', { name: /agregar mesa/i }))
    const card = await screen.findByRole('button', { name: /mesa 5/i })
    expect(card).toHaveTextContent('Libre')
    const post = vi.mocked(fetch).mock.calls.map((c) => readCall(c as [unknown, unknown])).find((c) => c.method === 'POST')
    expect(JSON.parse(post!.body as string)).toEqual({ number: 5, capacity: 6 })
  })

  it('muestra error amigable si el número de mesa ya existe', async () => {
    setup([], [{ method: 'POST', match: '/tables', response: jsonResponse({ detail: 'table_number_taken' }, 409) }])
    render(<TablesPage />)
    await screen.findByText('Todavía no cargaste ninguna mesa.')
    await userEvent.type(screen.getByLabelText(/número/i), '1')
    await userEvent.click(screen.getByRole('button', { name: /agregar mesa/i }))
    expect(await screen.findByText(/ya existe una mesa con ese número/i)).toBeInTheDocument()
  })

  it('edita una mesa desde el panel', async () => {
    setup([free('t2', 2)], [{ method: 'PATCH', match: '/tables/t2', response: jsonResponse({ id: 't2', number: 7, capacity: 2 }) }])
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 2/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const input = within(screen.getByRole('complementary', { name: /detalle/i })).getByLabelText('Número')
    await userEvent.clear(input)
    await userEvent.type(input, '7')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('button', { name: /mesa 7/i })).toBeInTheDocument()
  })

  it('borra una mesa ocupada tras confirmación explícita', async () => {
    setup([occupied], [{ method: 'DELETE', match: '/tables/t1', response: jsonResponse(null, 204) }])
    render(<TablesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /mesa 1/i }))
    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))
    expect(screen.getByText(/tiene pedidos activos/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /mesa 1/i })).not.toBeInTheDocument())
  })
})

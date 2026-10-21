import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicMenuPage from '../../pages/public/PublicMenuPage'
import { addOrderToken, getOrderTokens } from '../../lib/orderTokens'
import type { PublicMenuResponse, PublicOrderStatus } from '../../lib/types'
import { errorResponse, jsonResponse, readCall } from '../helpers'

global.fetch = vi.fn()

const TOKEN_A = 'a'.repeat(43)
const TOKEN_B = 'b'.repeat(43)

const menu: PublicMenuResponse = {
  restaurant: {
    name: 'Boulette', slug: 'boulette', orders_enabled: true, address: '', phone: '',
    logo_url: null, timezone: '', business_hours: [], is_open_now: false, whatsapp_enabled: false,
  },
  style: null,
  promo: null,
  tables: [{ id: 't5', number: 5, capacity: null }],
  categories: [
    {
      id: 'c1', name: 'Pizzas', type: 'food', icon: null,
      subcategories: [
        {
          id: 's1', name: 'Clásicas',
          items: [
            { id: 'i1', name: 'Margherita', description: 'Tomate', price: '10.00', image_url: null, category_id: 'c1', tags: [], modifiers: [] },
          ],
        },
      ],
    },
  ],
}

function status(over: Partial<PublicOrderStatus> = {}): PublicOrderStatus {
  return {
    token: TOKEN_A, status: 'accepted', created_at: '2026-07-07T10:00:00Z',
    payment_method: 'cash', payment_status: 'none', total: '10.00', table_number: 5,
    bill_requested: false,
    items: [{ name: 'Margherita', quantity: 1, subtotal: '10.00', modifiers: ['Extra queso'] }],
    ...over,
  }
}

let statusReply: () => Response
let billReply: () => Response

function calls(suffix: string) {
  return vi.mocked(fetch).mock.calls.map((c) => readCall(c as [unknown, unknown])).filter((c) => c.url.endsWith(suffix))
}

function setup(search = '?mesa=5', data: PublicMenuResponse = menu) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.endsWith('/orders/status')) return statusReply()
    if (url.endsWith('/orders/bill-request')) return billReply()
    if (method === 'POST' && url.endsWith('/orders')) {
      return jsonResponse({ id: 'ab12cd34-0000', customer_name: 'Ana', total: '10.00', items: [], public_token: TOKEN_B }, 201)
    }
    return jsonResponse(data)
  })
  return render(
    <MemoryRouter initialEntries={[`/menu/tok${search}`]}>
      <Routes>
        <Route path="/menu/:qrToken" element={<PublicMenuPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  statusReply = () => jsonResponse([status()])
  billReply = () => jsonResponse({ bill_requested: true, bill_requested_at: '2026-07-07T10:05:00Z' })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Tu consumo (M37)', () => {
  it('aparece con mesa válida y pedidos vigentes, con el total', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    setup()
    expect(await screen.findByRole('button', { name: /tu consumo, total \$10\.00/i })).toBeInTheDocument()
    expect(calls('/orders/status')[0].body).toBe(JSON.stringify({ tokens: [TOKEN_A] }))
  })

  it.each([
    ['sin mesa', '', true],
    ['sin pedidos guardados', '?mesa=5', false],
  ])('no aparece %s', async (_n, search, withToken) => {
    if (withToken) addOrderToken('tok', 5, TOKEN_A)
    setup(search)
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(screen.queryByRole('button', { name: /tu consumo/i })).not.toBeInTheDocument()
    expect(calls('/orders/status')).toHaveLength(0)
  })

  it('no aparece con pedidos deshabilitados', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    setup('?mesa=5', { ...menu, restaurant: { ...menu.restaurant, orders_enabled: false } })
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(screen.queryByRole('button', { name: /tu consumo/i })).not.toBeInTheDocument()
  })

  it('no aparece ni rompe si localStorage lanza', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => {
      if (k.startsWith('menu_orders_')) throw new Error('blocked')
      return null
    })
    setup()
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    expect(screen.queryByRole('button', { name: /tu consumo/i })).not.toBeInTheDocument()
  })

  it('no suma cancelados ni MP no aprobados y abre el panel con líneas y nota', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    addOrderToken('tok', 5, TOKEN_B)
    statusReply = () =>
      jsonResponse([
        status(),
        status({ token: 'c'.repeat(43), status: 'cancelled', total: '7.00' }),
        status({ token: TOKEN_B, payment_method: 'mercadopago', payment_status: 'pending', total: '5.00' }),
      ])
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo, total \$10\.00/i }))
    const dialog = screen.getByRole('dialog', { name: 'Tu consumo' })
    expect(dialog).toHaveTextContent('1 × Margherita')
    expect(dialog).toHaveTextContent('Extra queso')
    expect(dialog).toHaveTextContent('Cancelado')
    expect(dialog).toHaveTextContent('Pago pendiente')
    expect(dialog).toHaveTextContent('Solo muestra los pedidos hechos desde este celular.')
    expect(screen.getByTestId('consumo-total')).toHaveTextContent('$10.00')
  })

  it('no usa colores hex hardcodeados en el panel ni en el botón', async () => {
    const fs = await import('node:fs')
    for (const f of ['TuConsumoSheet.tsx']) {
      const src = fs.readFileSync(`src/components/public/${f}`, 'utf8')
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    }
  })

  it('Pedir cuenta llama con el token activo y queda "Cuenta pedida"', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Pedir cuenta' }))
    expect(await screen.findByRole('button', { name: 'Cuenta pedida' })).toBeDisabled()
    expect(screen.getByText('Ya avisamos al mozo')).toBeInTheDocument()
    expect(calls('/orders/bill-request')[0].body).toBe(JSON.stringify({ token: TOKEN_A }))
  })

  it('un refresh sin bill_requested resetea el estado local de cuenta pedida', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Pedir cuenta' }))
    expect(await screen.findByRole('button', { name: 'Cuenta pedida' })).toBeDisabled()
    const before = calls('/orders/status').length
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(calls('/orders/status').length).toBeGreaterThan(before))
    expect(await screen.findByRole('button', { name: 'Pedir cuenta' })).toBeEnabled()
  })

  it('cierra el panel cuando ya no quedan pedidos', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo/i }))
    expect(screen.getByRole('dialog', { name: 'Tu consumo' })).toBeInTheDocument()
    statusReply = () => jsonResponse([status({ status: 'completed' })])
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tu consumo' })).not.toBeInTheDocument())
  })

  it('con bill_requested=true del servidor ya viene deshabilitado', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    statusReply = () => jsonResponse([status({ bill_requested: true })])
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo/i }))
    expect(screen.getByRole('button', { name: 'Cuenta pedida' })).toBeDisabled()
  })

  it('sin pedidos activos "Pedir cuenta" está deshabilitado', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    statusReply = () => jsonResponse([status({ status: 'cancelled' })])
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo/i }))
    expect(screen.getByRole('button', { name: 'Pedir cuenta' })).toBeDisabled()
  })

  it('409 refresca y muestra el mensaje', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo/i }))
    billReply = () => errorResponse({ code: 'table_not_occupied', message: 'x' }, 409)
    const before = calls('/orders/status').length
    await userEvent.click(screen.getByRole('button', { name: 'Pedir cuenta' }))
    expect(await screen.findByText('Tu mesa ya no tiene pedidos activos')).toBeInTheDocument()
    await waitFor(() => expect(calls('/orders/status').length).toBeGreaterThan(before))
  })

  it('error distinto de 409 muestra alert y permite reintentar', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /tu consumo/i }))
    billReply = () => errorResponse('boom', 500)
    await userEvent.click(screen.getByRole('button', { name: 'Pedir cuenta' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedir cuenta' })).toBeEnabled()
  })

  it('todos completed: avisa, limpia el storage y desaparece el botón', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    statusReply = () => jsonResponse([status({ status: 'completed' })])
    setup()
    expect(await screen.findByText('Mesa cobrada, gracias')).toBeInTheDocument()
    expect(getOrderTokens('tok', 5)).toEqual([])
    expect(screen.queryByRole('button', { name: /tu consumo/i })).not.toBeInTheDocument()
  })

  it('mezcla: los completed se descartan sin sumar', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    addOrderToken('tok', 5, TOKEN_B)
    statusReply = () => jsonResponse([status({ status: 'completed', total: '99.00' }), status({ token: TOKEN_B })])
    setup()
    expect(await screen.findByRole('button', { name: /total \$10\.00/i })).toBeInTheDocument()
    expect(getOrderTokens('tok', 5)).toEqual([TOKEN_B])
  })

  it('purga los tokens que el servidor no devuelve', async () => {
    addOrderToken('tok', 5, TOKEN_A)
    addOrderToken('tok', 5, TOKEN_B)
    statusReply = () => jsonResponse([status()])
    setup()
    await screen.findByRole('button', { name: /tu consumo/i })
    expect(getOrderTokens('tok', 5)).toEqual([TOKEN_A])
  })
})

describe('Tu consumo — polling (M37)', () => {
  async function flush() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it('refresca cada 25 s, se pausa oculta, refresca al volver y limpia al desmontar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    addOrderToken('tok', 5, TOKEN_A)
    const { unmount } = setup()
    await screen.findByRole('button', { name: /tu consumo/i })
    expect(calls('/orders/status')).toHaveLength(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(25_000) })
    expect(calls('/orders/status')).toHaveLength(2)

    let visibility: DocumentVisibilityState = 'hidden'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    await act(async () => { await vi.advanceTimersByTimeAsync(50_000) })
    expect(calls('/orders/status')).toHaveLength(2)

    visibility = 'visible'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await flush()
    expect(calls('/orders/status')).toHaveLength(3)

    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(calls('/orders/status')).toHaveLength(3)
  })

  it('no solapa requests mientras uno sigue en vuelo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    addOrderToken('tok', 5, TOKEN_A)
    let release: (r: Response) => void = () => {}
    statusReply = (() => new Promise<Response>((res) => { release = res })) as unknown as () => Response
    setup()
    await waitFor(() => expect(calls('/orders/status')).toHaveLength(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(75_000) })
    expect(calls('/orders/status')).toHaveLength(1)
    await act(async () => { release(jsonResponse([status()])) })
  })

  it('un error de red conserva el último estado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    addOrderToken('tok', 5, TOKEN_A)
    setup()
    await screen.findByRole('button', { name: /tu consumo/i })
    statusReply = () => { throw new Error('network') }
    await act(async () => { await vi.advanceTimersByTimeAsync(25_000) })
    expect(screen.getByRole('button', { name: /tu consumo/i })).toBeInTheDocument()
  })
})

describe('Checkout guarda el public_token (M37)', () => {
  async function checkout(takeaway = false) {
    await screen.findByRole('heading', { name: 'Boulette', level: 1 })
    await userEvent.click(screen.getByRole('button', { name: /agregar margherita/i }))
    await screen.findByRole('dialog', { name: 'Margherita' })
    await userEvent.click(screen.getByRole('button', { name: /añadir al pedido/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver carrito' }))
    await userEvent.click(screen.getByRole('button', { name: /finalizar pedido/i }))
    if (takeaway) await userEvent.click(screen.getByRole('button', { name: /para llevar/i }))
    await userEvent.type(screen.getByLabelText(/tu nombre/i), 'Ana')
    await userEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }))
    await screen.findByTestId('order-confirmation')
  }

  it('con mesa bloqueada guarda el token', async () => {
    statusReply = () => jsonResponse([status({ token: TOKEN_B })])
    setup('?mesa=5')
    await checkout()
    expect(getOrderTokens('tok', 5)).toEqual([TOKEN_B])
  })

  it('sin mesa no guarda nada', async () => {
    setup('')
    await checkout(true)
    expect(localStorage.getItem('menu_orders_tok')).toBeNull()
  })
})

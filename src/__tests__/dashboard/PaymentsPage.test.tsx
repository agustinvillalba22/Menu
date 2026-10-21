import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import PaymentsPage from '../../pages/dashboard/PaymentsPage'
import type { MercadoPagoStatus, Restaurant } from '../../lib/types'
import { errorResponse, jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()

const assign = vi.fn()
const realLocation = window.location

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, assign },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

const owner: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: true,
  role: 'owner',
}
const editor: Restaurant = { ...owner, role: 'editor' }

const notConnected: MercadoPagoStatus = {
  configured: true,
  connected: false,
  status: null,
  mp_user_id: null,
}
const connected: MercadoPagoStatus = {
  configured: true,
  connected: true,
  status: 'connected',
  mp_user_id: '777',
}
const disconnectedAccount: MercadoPagoStatus = {
  configured: true,
  connected: false,
  status: 'disconnected',
  mp_user_id: '777',
}
const notConfigured: MercadoPagoStatus = {
  configured: false,
  connected: false,
  status: null,
  mp_user_id: null,
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="search">{loc.search}</div>
}

function renderPage(entry = '/dashboard/payments') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PaymentsPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function routes(restaurant: Restaurant, status: MercadoPagoStatus) {
  return [
    { method: 'GET', match: '/payments/mercadopago', response: jsonResponse(status) },
    { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
  ]
}

function callsTo(method: string, fragment: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.method === method && c.url.includes(fragment))
}

describe('PaymentsPage', () => {
  it('warns when the server has no Mercado Pago integration configured', async () => {
    routeFetch(routes(owner, notConfigured))

    renderPage()

    expect(await screen.findByText(/no está configurada en el servidor/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conectar con Mercado Pago' })).not.toBeInTheDocument()
  })

  it('offers "Conectar con Mercado Pago" to the owner when disconnected and redirects to the authorization url', async () => {
    routeFetch([
      ...routes(owner, notConnected),
      {
        method: 'POST',
        match: '/payments/mercadopago/connect',
        response: jsonResponse({ authorization_url: 'https://auth.mercadopago.com/authorization?s=1' }),
      },
    ])

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Conectar con Mercado Pago' }))

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://auth.mercadopago.com/authorization?s=1'),
    )
    expect(callsTo('POST', '/restaurants/r1/payments/mercadopago/connect')).toHaveLength(1)
  })

  it('shows an error when starting the connection fails', async () => {
    routeFetch([
      ...routes(owner, notConnected),
      {
        method: 'POST',
        match: '/payments/mercadopago/connect',
        response: errorResponse('payments_not_configured', 503),
      },
    ])

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Conectar con Mercado Pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo iniciar la conexión/i)
    expect(assign).not.toHaveBeenCalled()
  })

  it('shows "Cuenta conectada" with a disconnect button when connected', async () => {
    routeFetch(routes(owner, connected))

    renderPage()

    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conectar con Mercado Pago' })).not.toBeInTheDocument()
  })

  it('asks for inline confirmation before disconnecting, and can cancel', async () => {
    routeFetch(routes(owner, connected))

    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))

    expect(screen.getByText(/¿desconectar tu cuenta/i)).toBeInTheDocument()
    expect(callsTo('DELETE', '/payments/mercadopago')).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/¿desconectar tu cuenta/i)).not.toBeInTheDocument()
    expect(callsTo('DELETE', '/payments/mercadopago')).toHaveLength(0)
  })

  it('disconnects after confirming and goes back to the connect state', async () => {
    routeFetch([
      { method: 'DELETE', match: '/payments/mercadopago', response: jsonResponse(null, 204) },
      ...routes(owner, connected),
    ])

    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))
    await userEvent.click(screen.getByRole('button', { name: /sí, desconectar/i }))

    expect(await screen.findByRole('button', { name: 'Conectar con Mercado Pago' })).toBeInTheDocument()
    expect(callsTo('DELETE', '/restaurants/r1/payments/mercadopago')).toHaveLength(1)
    expect(screen.queryByText('Cuenta conectada')).not.toBeInTheDocument()
  })

  it('asks to reconnect when the account status is disconnected', async () => {
    routeFetch(routes(owner, disconnectedAccount))

    renderPage()

    expect(await screen.findByText(/reconectá tu cuenta/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conectar con Mercado Pago' })).toBeInTheDocument()
    expect(screen.queryByText('Cuenta conectada')).not.toBeInTheDocument()
  })

  it('is read-only for editors when connected', async () => {
    routeFetch(routes(editor, connected))

    renderPage()

    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conectar con Mercado Pago' })).not.toBeInTheDocument()
  })

  it('is read-only for editors when not connected', async () => {
    routeFetch(routes(editor, notConnected))

    renderPage()

    expect(await screen.findByText(/solo el administrador puede conectar/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conectar con Mercado Pago' })).not.toBeInTheDocument()
  })

  it('shows a success message for ?mp=connected and clears the query param', async () => {
    routeFetch(routes(owner, connected))

    renderPage('/dashboard/payments?mp=connected')

    expect(await screen.findByText(/cuenta de mercado pago conectada correctamente/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/))
  })

  it('shows an error message for ?mp=error and clears the query param', async () => {
    routeFetch(routes(owner, notConnected))

    renderPage('/dashboard/payments?mp=error')

    expect(await screen.findByText(/no se pudo conectar tu cuenta de mercado pago/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/))
  })

  it('shows an error when the status cannot be loaded', async () => {
    routeFetch([
      { method: 'GET', match: '/payments/mercadopago', response: errorResponse('boom', 500) },
      { method: 'GET', match: '/restaurants', response: jsonResponse([owner]) },
    ])

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo cargar el estado/i)
  })
})

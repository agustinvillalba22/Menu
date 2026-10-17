import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  connectMercadoPago,
  disconnectMercadoPago,
  getMercadoPagoStatus,
  getPublicPaymentStatus,
} from '../../lib/payments'
import { jsonResponse, readCall } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

function lastCall() {
  const calls = vi.mocked(fetch).mock.calls
  return readCall(calls[calls.length - 1] as [unknown, unknown])
}

describe('payments api', () => {
  it('getMercadoPagoStatus GETs the restaurant account status', async () => {
    const status = { configured: true, connected: true, status: 'connected', mp_user_id: '123' }
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(status))

    await expect(getMercadoPagoStatus('r1')).resolves.toEqual(status)

    expect(lastCall()).toMatchObject({
      url: 'http://api.test/restaurants/r1/payments/mercadopago',
      method: 'GET',
    })
  })

  it('connectMercadoPago POSTs to /connect and returns only the authorization url', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ authorization_url: 'https://auth.mercadopago.com/authorization?x=1' }),
    )

    await expect(connectMercadoPago('r1')).resolves.toBe(
      'https://auth.mercadopago.com/authorization?x=1',
    )

    expect(lastCall()).toMatchObject({
      url: 'http://api.test/restaurants/r1/payments/mercadopago/connect',
      method: 'POST',
    })
  })

  it('disconnectMercadoPago sends DELETE', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, 204))

    await disconnectMercadoPago('r1')

    expect(lastCall()).toMatchObject({
      url: 'http://api.test/restaurants/r1/payments/mercadopago',
      method: 'DELETE',
    })
  })

  it('getPublicPaymentStatus GETs the public order payment endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ payment_status: 'pending', status: 'pending' }),
    )

    await expect(getPublicPaymentStatus('qr-1', 'o1')).resolves.toEqual({
      payment_status: 'pending',
      status: 'pending',
    })

    expect(lastCall()).toMatchObject({
      url: 'http://api.test/menu/qr-1/orders/o1/payment',
      method: 'GET',
    })
  })
})

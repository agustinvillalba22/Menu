import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import {
  listAdminUsers,
  updateAdminUser,
  listAdminRestaurants,
  updateAdminRestaurant,
} from '../../lib/admin'
import { jsonResponse, readCall } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const adminUser = {
  id: 'u1',
  email: 'admin@example.com',
  full_name: 'Admin',
  is_active: true,
  is_superadmin: true,
  created_at: '2026-01-01T00:00:00Z',
}

const adminRestaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  is_active: true,
  orders_enabled: false,
  owner_email: 'owner@example.com',
}

describe('lib/admin', () => {
  it('listAdminUsers GETs /admin/users', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([adminUser]))

    const result = await listAdminUsers()
    expect(result).toEqual([adminUser])

    const call = readCall(vi.mocked(fetch).mock.calls[0] as [unknown, unknown])
    expect(call.url).toBe('http://api.test/admin/users')
    expect(call.method).toBe('GET')
  })

  it('updateAdminUser PATCHes /admin/users/{id} with only the changed field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...adminUser, is_superadmin: true }))

    await updateAdminUser('u1', { is_superadmin: true })

    const call = readCall(vi.mocked(fetch).mock.calls[0] as [unknown, unknown])
    expect(call.url).toBe('http://api.test/admin/users/u1')
    expect(call.method).toBe('PATCH')
    expect(JSON.parse(call.body as string)).toEqual({ is_superadmin: true })
  })

  it('listAdminRestaurants GETs /admin/restaurants', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([adminRestaurant]))

    const result = await listAdminRestaurants()
    expect(result).toEqual([adminRestaurant])

    const call = readCall(vi.mocked(fetch).mock.calls[0] as [unknown, unknown])
    expect(call.url).toBe('http://api.test/admin/restaurants')
    expect(call.method).toBe('GET')
  })

  it('updateAdminRestaurant PATCHes /admin/restaurants/{id} with is_active', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...adminRestaurant, is_active: false }))

    await updateAdminRestaurant('r1', { is_active: false })

    const call = readCall(vi.mocked(fetch).mock.calls[0] as [unknown, unknown])
    expect(call.url).toBe('http://api.test/admin/restaurants/r1')
    expect(call.method).toBe('PATCH')
    expect(JSON.parse(call.body as string)).toEqual({ is_active: false })
  })
})

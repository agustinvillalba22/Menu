import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiPatch } from '../../lib/api'
import { jsonResponse, readCall } from '../helpers'

// RF-01 / underpins CA-04: apiPatch must send method PATCH and serialize the
// body to JSON, mirroring apiPost.

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

describe('apiPatch', () => {
  it('sends a PATCH request with the body serialized as JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiPatch('/restaurants/r1/style', { primary_color: '#112233' })

    expect(fetch).toHaveBeenCalledTimes(1)
    const call = readCall(vi.mocked(fetch).mock.calls[0] as [unknown, unknown])
    expect(call.method).toBe('PATCH')
    expect(call.url).toBe('http://api.test/restaurants/r1/style')
    expect(call.body).toBe(JSON.stringify({ primary_color: '#112233' }))
  })

  it('omits the body when none is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiPatch('/restaurants/r1/style')

    const call = readCall(vi.mocked(fetch).mock.calls[0] as [unknown, unknown])
    expect(call.method).toBe('PATCH')
    expect(call.body).toBeUndefined()
  })

  it('sends credentials with the request (cookie-based auth)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiPatch('/restaurants/r1/style', {})

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('include')
  })
})

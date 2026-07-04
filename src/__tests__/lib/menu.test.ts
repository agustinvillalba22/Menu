import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importItemsCsv } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import { errorResponse, jsonResponse } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

function csvFile() {
  return new File(['a,b'], 'menu.csv', { type: 'text/csv' })
}

describe('importItemsCsv / apiUpload', () => {
  // CA-09/CA-13 (transport): builds multipart FormData, no manual Content-Type.
  it('POSTs a FormData with the file and no Content-Type header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ imported: 2, errors: [] }))

    const result = await importItemsCsv('r1', csvFile())
    expect(result).toEqual({ imported: 2, errors: [] })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe('http://api.test/restaurants/r1/items/import')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).credentials).toBe('include')
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
    expect(((init as RequestInit).body as FormData).get('file')).toBeInstanceOf(File)
    expect((init as RequestInit).headers).toBeUndefined()
  })

  // CA-13: a 413 rejects with an ApiError carrying status 413 + detail.
  it('rejects with ApiError(status=413, detail="file_too_large") on 413', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse('file_too_large', 413))

    await expect(importItemsCsv('r1', csvFile())).rejects.toMatchObject({
      name: 'ApiError',
      status: 413,
      detail: 'file_too_large',
    })
    // And it is a real ApiError instance.
    await vi.mocked(fetch).mockResolvedValueOnce(errorResponse('file_too_large', 413))
    await expect(importItemsCsv('r1', csvFile())).rejects.toBeInstanceOf(ApiError)
  })
})

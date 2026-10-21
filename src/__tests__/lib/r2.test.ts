import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadImageToR2 } from '../../lib/r2'
import { ApiError } from '../../lib/api'
import { jsonResponse } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const UPLOAD_URL = 'https://r2.example.com/presigned-put?sig=abc'

function imageFile(type = 'image/jpeg') {
  return new File(['binary'], 'photo.jpg', { type })
}

describe('uploadImageToR2', () => {
  it('PUTs the raw file to the presigned URL with the file Content-Type, no API prefix, no credentials', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 200))
    const file = imageFile('image/png')

    await expect(uploadImageToR2(UPLOAD_URL, file)).resolves.toBeUndefined()

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    // The URL is used verbatim — NOT prefixed with VITE_API_URL.
    expect(String(url)).toBe(UPLOAD_URL)
    const request = init as RequestInit
    expect(request.method).toBe('PUT')
    expect(request.body).toBe(file)
    expect((request.headers as Record<string, string>)['Content-Type']).toBe('image/png')
    // The session cookie must never be sent to the external R2 origin.
    expect(request.credentials).toBeUndefined()
  })

  it('throws a plain Error (not ApiError) when R2 responds non-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 403))
    await expect(uploadImageToR2(UPLOAD_URL, imageFile())).rejects.toBeInstanceOf(
      Error,
    )

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 403))
    await expect(uploadImageToR2(UPLOAD_URL, imageFile())).rejects.not.toBeInstanceOf(
      ApiError,
    )
  })
})

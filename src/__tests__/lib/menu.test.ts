import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  importItemsCsv,
  getItemImageUploadUrl,
  confirmItemImageUpload,
  deleteItemImage,
  uploadImageToR2,
} from '../../lib/menu'
import { ApiError } from '../../lib/api'
import { errorResponse, jsonResponse } from '../helpers'
import type { Item, ItemImageUploadResponse } from '../../lib/types'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

function csvFile() {
  return new File(['a,b'], 'menu.csv', { type: 'text/csv' })
}

function imageFile(type = 'image/jpeg') {
  return new File(['binary'], 'photo.jpg', { type })
}

const uploadResponse: ItemImageUploadResponse = {
  upload_url: 'https://r2.example.com/presigned-put?sig=abc',
  object_key: 'restaurants/r1/items/i1/original.jpg',
  expires_in: 900,
}

const confirmedItem: Item = {
  id: 'i1',
  name: 'Milanesa',
  description: 'con papas',
  price: '10.00',
  image_url: 'https://cdn.example.com/items/i1.jpg',
  subcategory_id: 's1',
  tags: [],
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

// --- M10: item image upload client (RF-01 to RF-04) ------------------------
// Placed after the existing suites on purpose: in the RED phase these fns don't
// exist yet, so the calls throw before consuming their queued fetch mocks, and
// `clearAllMocks` doesn't reset implementations. Running these last keeps the
// leak from reaching the earlier suites.

describe('getItemImageUploadUrl (RF-01)', () => {
  it('POSTs to .../image/upload-url with the content_type + file_size body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(uploadResponse))

    const result = await getItemImageUploadUrl('r1', 's1', 'i1', {
      content_type: 'image/jpeg',
      file_size: 2048,
    })
    expect(result).toEqual(uploadResponse)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe(
      'http://api.test/restaurants/r1/subcategories/s1/items/i1/image/upload-url',
    )
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      content_type: 'image/jpeg',
      file_size: 2048,
    })
  })
})

describe('confirmItemImageUpload (RF-02)', () => {
  it('POSTs to .../image/confirm with {object_key} and returns the updated Item', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(confirmedItem))

    const result = await confirmItemImageUpload('r1', 's1', 'i1', uploadResponse.object_key)
    expect(result).toEqual(confirmedItem)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe(
      'http://api.test/restaurants/r1/subcategories/s1/items/i1/image/confirm',
    )
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      object_key: uploadResponse.object_key,
    })
  })
})

describe('deleteItemImage (RF-03)', () => {
  it('DELETEs .../image and resolves void on 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 204))

    await expect(deleteItemImage('r1', 's1', 'i1')).resolves.toBeUndefined()

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe('http://api.test/restaurants/r1/subcategories/s1/items/i1/image')
    expect((init as RequestInit).method).toBe('DELETE')
  })
})

describe('uploadImageToR2 (RF-04)', () => {
  it('PUTs the raw file to the presigned URL with the file Content-Type, no API prefix, no credentials', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 200))
    const file = imageFile('image/png')

    await expect(uploadImageToR2(uploadResponse.upload_url, file)).resolves.toBeUndefined()

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    // The URL is used verbatim — NOT prefixed with VITE_API_URL.
    expect(String(url)).toBe(uploadResponse.upload_url)
    const request = init as RequestInit
    expect(request.method).toBe('PUT')
    expect(request.body).toBe(file)
    expect((request.headers as Record<string, string>)['Content-Type']).toBe('image/png')
    // RNF-02: the session cookie must never be sent to the external R2 origin.
    expect(request.credentials).toBeUndefined()
  })

  it('throws a plain Error (not ApiError) when R2 responds non-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 403))
    await expect(uploadImageToR2(uploadResponse.upload_url, imageFile())).rejects.toBeInstanceOf(
      Error,
    )

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(undefined, 403))
    await expect(uploadImageToR2(uploadResponse.upload_url, imageFile())).rejects.not.toBeInstanceOf(
      ApiError,
    )
  })
})

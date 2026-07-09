import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ItemImageUpload from '../../components/dashboard/ItemImageUpload'
import {
  getItemImageUploadUrl,
  confirmItemImageUpload,
  deleteItemImage,
  uploadImageToR2,
} from '../../lib/menu'
import type { Item, ItemImageUploadResponse } from '../../lib/types'

// The whole menu client is mocked: this is a component test and must never do a
// real fetch (neither to our API nor to R2). Each API function the component
// depends on is a vi.fn() we can arrange/assert on per case.
vi.mock('../../lib/menu', () => ({
  getItemImageUploadUrl: vi.fn(),
  confirmItemImageUpload: vi.fn(),
  deleteItemImage: vi.fn(),
  uploadImageToR2: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

const CDN_URL = 'https://cdn.example.com/items/i1.jpg'

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
  image_url: CDN_URL,
  subcategory_id: 's1',
  tags: [],
}

/**
 * Builds a File with a controlled `size` (jsdom ignores the byte content for
 * `.size`, so we override it) to exercise the client-side size validation.
 */
function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

/**
 * The file input has no reliably-associated accessible label in the spec
 * (RF-06 only guarantees a "Subir imagen" control). Querying the raw
 * `input[type="file"]` is the documented last-resort accessible fallback for
 * file inputs — see 07_frontend_tester guidance / task note.
 */
function getFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('no <input type="file"> found in ItemImageUpload')
  return input
}

function renderUpload(imageUrl: string | null = null, onImageChange = vi.fn()) {
  const utils = render(
    <ItemImageUpload
      restaurantId="r1"
      subcategoryId="s1"
      itemId="i1"
      imageUrl={imageUrl}
      onImageChange={onImageChange}
    />,
  )
  return { onImageChange, ...utils }
}

describe('ItemImageUpload', () => {
  // CA-05: an item without image shows the placeholder + upload control.
  it('renders the placeholder and an upload control when there is no image', () => {
    const { container } = renderUpload(null)

    expect(screen.getByText(/subir imagen/i)).toBeInTheDocument()
    expect(getFileInput(container)).toBeInTheDocument()
    // No thumbnail and no replace/remove buttons in the empty state.
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument()
  })

  // CA-05: an item with an image shows the thumbnail + replace/remove buttons.
  it('renders the thumbnail and replace/remove buttons when there is an image', () => {
    const { container } = renderUpload(CDN_URL)

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', CDN_URL)
    expect(screen.getByRole('button', { name: /reemplazar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /quitar/i })).toBeInTheDocument()
  })

  // CA-01: an unsupported type (.gif) shows the format error inline WITHOUT
  // hitting the backend — getItemImageUploadUrl must not be called.
  it('rejects an unsupported file type inline without calling the API', async () => {
    const { container, onImageChange } = renderUpload(null)

    await userEvent.upload(getFileInput(container), makeFile('x.gif', 'image/gif'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/formato no soportado/i)
    expect(getItemImageUploadUrl).not.toHaveBeenCalled()
    expect(onImageChange).not.toHaveBeenCalled()
  })

  // CA-02: a file over 5 MiB shows the size error inline WITHOUT hitting the
  // backend — getItemImageUploadUrl must not be called.
  it('rejects a file over 5 MiB inline without calling the API', async () => {
    const { container, onImageChange } = renderUpload(null)

    const tooBig = makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)
    await userEvent.upload(getFileInput(container), tooBig)

    expect(await screen.findByRole('alert')).toHaveTextContent(/tamaño máximo/i)
    expect(getItemImageUploadUrl).not.toHaveBeenCalled()
    expect(onImageChange).not.toHaveBeenCalled()
  })

  // CA-03: a valid file drives the full sequence
  // upload-url -> PUT to R2 -> confirm -> onImageChange(item.image_url).
  it('runs the full upload sequence for a valid file', async () => {
    vi.mocked(getItemImageUploadUrl).mockResolvedValue(uploadResponse)
    vi.mocked(uploadImageToR2).mockResolvedValue(undefined)
    vi.mocked(confirmItemImageUpload).mockResolvedValue(confirmedItem)

    const { container, onImageChange } = renderUpload(null)

    const file = makeFile('mila.jpg', 'image/jpeg', 2048)
    await userEvent.upload(getFileInput(container), file)

    // 1. presigned URL requested with content_type + file_size.
    expect(getItemImageUploadUrl).toHaveBeenCalledWith('r1', 's1', 'i1', {
      content_type: 'image/jpeg',
      file_size: 2048,
    })
    // 2. binary PUT to R2 using the returned upload_url and the raw File.
    expect(uploadImageToR2).toHaveBeenCalledWith(uploadResponse.upload_url, file)
    // 3. confirm with the returned object_key.
    expect(confirmItemImageUpload).toHaveBeenCalledWith('r1', 's1', 'i1', uploadResponse.object_key)
    // 4. parent notified with the confirmed item's image_url.
    expect(onImageChange).toHaveBeenCalledWith(CDN_URL)
  })

  // CA-04: if the R2 PUT fails, an error is shown, onImageChange is NOT called,
  // and confirm is never reached (image state stays as it was).
  it('shows an error and does not notify the parent when the R2 upload fails', async () => {
    vi.mocked(getItemImageUploadUrl).mockResolvedValue(uploadResponse)
    vi.mocked(uploadImageToR2).mockRejectedValue(new Error('R2 unreachable'))

    const { container, onImageChange } = renderUpload(null)

    await userEvent.upload(getFileInput(container), makeFile('mila.jpg', 'image/jpeg', 2048))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(confirmItemImageUpload).not.toHaveBeenCalled()
    expect(onImageChange).not.toHaveBeenCalled()
    // Still in the empty/placeholder state — nothing half-set.
    expect(screen.getByText(/subir imagen/i)).toBeInTheDocument()
  })

  // CA-06: "Quitar" (after inline confirmation) deletes the image and notifies
  // the parent with null.
  it('deletes the image after inline confirmation and notifies the parent with null', async () => {
    vi.mocked(deleteItemImage).mockResolvedValue(undefined)

    const { onImageChange } = renderUpload(CDN_URL)

    await userEvent.click(screen.getByRole('button', { name: /quitar/i }))
    // Inline confirmation (no native window.confirm) — the DELETE only fires
    // after confirming.
    expect(deleteItemImage).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /sí, (quitar|borrar)/i }))

    expect(deleteItemImage).toHaveBeenCalledWith('r1', 's1', 'i1')
    expect(onImageChange).toHaveBeenCalledWith(null)
  })

  // CA-07: while an upload is in flight the controls are busy/disabled, so a
  // second upload can't start in parallel on the same item.
  it('disables the control and prevents a second parallel upload while busy', async () => {
    // Keep the first step pending so the component stays in its busy state.
    let resolveGet: (value: ItemImageUploadResponse) => void = () => {}
    vi.mocked(getItemImageUploadUrl).mockReturnValue(
      new Promise<ItemImageUploadResponse>((resolve) => {
        resolveGet = resolve
      }),
    )
    vi.mocked(uploadImageToR2).mockResolvedValue(undefined)
    vi.mocked(confirmItemImageUpload).mockResolvedValue(confirmedItem)

    const { container } = renderUpload(null)
    const input = getFileInput(container)

    await userEvent.upload(input, makeFile('mila.jpg', 'image/jpeg', 2048))

    // The upload started once and the control is now disabled.
    expect(getItemImageUploadUrl).toHaveBeenCalledTimes(1)
    expect(input).toBeDisabled()

    // Unblock so the pending promise chain can settle before the test ends.
    resolveGet(uploadResponse)
    await screen.findByRole('button', { name: /reemplazar/i })
    expect(getItemImageUploadUrl).toHaveBeenCalledTimes(1)
  })
})

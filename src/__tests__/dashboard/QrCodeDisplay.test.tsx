import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QrCodeDisplay from '../../components/dashboard/QrCodeDisplay'

/**
 * The `qrcode` library is mocked. We assume the component uses the
 * Promise-based data-URL API:
 *
 *   import QRCode from 'qrcode'
 *   const dataUrl = await QRCode.toDataURL(value, { width, errorCorrectionLevel })
 *
 * `toDataURL(value, options): Promise<string>` returns a `data:image/png;base64,...`
 * URL that is used both as the preview `<img src>` and as the `<a download href>`.
 * The Developer MUST use this same API (default export, `toDataURL`).
 */
const { toDataURLMock } = vi.hoisted(() => ({ toDataURLMock: vi.fn() }))
vi.mock('qrcode', () => ({
  default: { toDataURL: toDataURLMock },
}))

const FAKE_PNG = 'data:image/png;base64,ZmFrZS1wbmc='
const VALUE = 'http://localhost:3000/menu/qr-abc'
const FILE_NAME = 'boulette-qr.png'

beforeEach(() => {
  vi.clearAllMocks()
  toDataURLMock.mockResolvedValue(FAKE_PNG)
})

describe('QrCodeDisplay', () => {
  // CA-01 / RF-02: renders the generated QR as a visible image.
  it('renders the QR image generated from the value', async () => {
    render(<QrCodeDisplay value={VALUE} fileName={FILE_NAME} />)

    const img = await screen.findByRole('img', { name: /qr/i })
    expect(img).toHaveAttribute('src', FAKE_PNG)
  })

  // CA-02 (component side) / RF-03: the exact `value` prop is what gets encoded,
  // verbatim — no relative path, no rewriting.
  it('encodes exactly the value prop into the QR', async () => {
    render(<QrCodeDisplay value={VALUE} fileName={FILE_NAME} />)

    await screen.findByRole('img', { name: /qr/i })
    expect(toDataURLMock).toHaveBeenCalledWith(VALUE, expect.any(Object))
  })

  // RF-06: fixed print-legible size (240px) and error correction level M or higher.
  it('generates the QR at a print-legible size with error correction M+', async () => {
    render(<QrCodeDisplay value={VALUE} fileName={FILE_NAME} />)

    await screen.findByRole('img', { name: /qr/i })
    const options = toDataURLMock.mock.calls[0]?.[1] as {
      width?: number
      errorCorrectionLevel?: string
    }
    expect(options.width).toBe(240)
    expect(['M', 'Q', 'H']).toContain(options.errorCorrectionLevel)
  })

  // CA-03 / RF-04: clicking "Descargar QR" triggers a client-side PNG download
  // via a synthetic <a download href="data:..."> whose click is dispatched.
  it('downloads a PNG when the download button is clicked', async () => {
    const realCreateElement = document.createElement.bind(document)
    let anchor: HTMLAnchorElement | null = null
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        const el = realCreateElement(tagName, options)
        if (tagName.toLowerCase() === 'a') {
          anchor = el as HTMLAnchorElement
          vi.spyOn(anchor, 'click').mockImplementation(() => {})
        }
        return el
      })

    try {
      render(<QrCodeDisplay value={VALUE} fileName={FILE_NAME} />)

      // Wait for the QR to be ready before the download can succeed.
      await screen.findByRole('img', { name: /qr/i })
      await userEvent.click(screen.getByRole('button', { name: /descargar qr/i }))

      expect(anchor).not.toBeNull()
      expect(anchor!.href).toContain('data:image/png')
      expect(anchor!.getAttribute('download')).toBe(FILE_NAME)
      expect(anchor!.click).toHaveBeenCalledTimes(1)
    } finally {
      createElementSpy.mockRestore()
    }
  })

  // CA-04: the downloaded file name is the provided one (carries the slug),
  // not a generic fixed name.
  it('uses the provided fileName (with the restaurant slug) for the download', async () => {
    const realCreateElement = document.createElement.bind(document)
    let anchor: HTMLAnchorElement | null = null
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        const el = realCreateElement(tagName, options)
        if (tagName.toLowerCase() === 'a') {
          anchor = el as HTMLAnchorElement
          vi.spyOn(anchor, 'click').mockImplementation(() => {})
        }
        return el
      })

    try {
      render(<QrCodeDisplay value={VALUE} fileName="mi-resto-qr.png" />)

      await screen.findByRole('img', { name: /qr/i })
      await userEvent.click(screen.getByRole('button', { name: /descargar qr/i }))

      expect(anchor!.getAttribute('download')).toBe('mi-resto-qr.png')
    } finally {
      createElementSpy.mockRestore()
    }
  })
})

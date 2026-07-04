import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CsvImportForm from '../../components/dashboard/CsvImportForm'
import { jsonResponse, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

function csvFile() {
  return new File(['name,price\nCafe,2.50'], 'menu.csv', { type: 'text/csv' })
}

/** Finds the recorded import POST call (url, init) or fails. */
function importCall() {
  const call = vi
    .mocked(fetch)
    .mock.calls.find((c) => String(c[0]).includes('/items/import'))
  expect(call).toBeDefined()
  return { url: String(call![0]), init: (call![1] ?? {}) as RequestInit }
}

describe('CsvImportForm', () => {
  // CA-09: a valid CSV is POSTed as multipart/form-data with no manual
  // Content-Type header; a {imported: 3, errors: []} result renders "3 importados".
  it('uploads the file as multipart and shows the success count', async () => {
    routeFetch([
      { method: 'POST', match: '/import', response: jsonResponse({ imported: 3, errors: [] }) },
    ])

    render(<CsvImportForm restaurantId="r1" />)

    await userEvent.upload(screen.getByLabelText(/archivo csv/i), csvFile())
    await userEvent.click(screen.getByRole('button', { name: /importar/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/3 importados/i)
    expect(screen.queryByText(/fila/i)).not.toBeInTheDocument()

    const { url, init } = importCall()
    expect(url).toBe('http://api.test/restaurants/r1/items/import')
    expect(init.method).toBe('POST')
    // Multipart: body is a FormData carrying the file, no manual Content-Type.
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
    expect(init.headers).toBeUndefined()
  })

  // CA-10: a result with row errors shows the imported count and each failing row.
  it('shows per-row errors alongside the imported count', async () => {
    routeFetch([
      {
        method: 'POST',
        match: '/import',
        response: jsonResponse({
          imported: 1,
          errors: [{ row: 4, reason: 'invalid_price', detail: null }],
        }),
      },
    ])

    render(<CsvImportForm restaurantId="r1" />)

    await userEvent.upload(screen.getByLabelText(/archivo csv/i), csvFile())
    await userEvent.click(screen.getByRole('button', { name: /importar/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/1 importado/i)
    expect(screen.getByText(/fila 4:\s*invalid_price/i)).toBeInTheDocument()
  })

  // CA-13 (UI surface): an ApiError from the upload renders a visible alert.
  it('shows an error alert when the import fails', async () => {
    routeFetch([
      {
        method: 'POST',
        match: '/import',
        response: jsonResponse({ detail: 'file_too_large' }, 413),
      },
    ])

    render(<CsvImportForm restaurantId="r1" />)

    await userEvent.upload(screen.getByLabelText(/archivo csv/i), csvFile())
    await userEvent.click(screen.getByRole('button', { name: /importar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/file_too_large/i)
  })
})

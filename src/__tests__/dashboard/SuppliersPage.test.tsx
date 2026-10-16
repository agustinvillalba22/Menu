import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SuppliersPage from '../../pages/dashboard/SuppliersPage'
import type { Supplier } from '../../lib/types'
import { jsonResponse, routeFetch } from '../helpers'
import { restaurantFixture } from './fixtures'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const supplier: Supplier = {
  id: 'sup1',
  name: 'Distribuidora X',
  category: null,
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  delivery_days: null,
  payment_terms: null,
  notes: null,
  active: true,
}

describe('SuppliersPage', () => {
  it('lists suppliers', async () => {
    routeFetch([
      { match: '/suppliers', response: jsonResponse([supplier]) },
      { match: '/restaurants', response: jsonResponse([restaurantFixture]) },
    ])
    render(<SuppliersPage />)
    expect(await screen.findByText('Distribuidora X')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    routeFetch([
      { match: '/suppliers', response: jsonResponse([]) },
      { match: '/restaurants', response: jsonResponse([restaurantFixture]) },
    ])
    render(<SuppliersPage />)
    expect(await screen.findByText('Todavía no cargaste ningún proveedor.')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    routeFetch([
      { match: '/suppliers', response: jsonResponse({ detail: 'x' }, 500) },
      { match: '/restaurants', response: jsonResponse([restaurantFixture]) },
    ])
    render(<SuppliersPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los proveedores.')
  })

  it('creates a supplier', async () => {
    routeFetch([
      { match: '/suppliers', response: jsonResponse([]) },
      { match: '/restaurants', response: jsonResponse([restaurantFixture]) },
      {
        method: 'POST',
        match: '/suppliers',
        response: jsonResponse({ ...supplier, id: 'sup9', name: 'Proveedor Nuevo' }, 201),
      },
    ])
    render(<SuppliersPage />)
    await screen.findByText('Todavía no cargaste ningún proveedor.')

    await userEvent.type(screen.getByLabelText(/^nombre$/i), 'Proveedor Nuevo')
    await userEvent.click(screen.getByRole('button', { name: /agregar proveedor/i }))

    expect(await screen.findByText('Proveedor Nuevo')).toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RestaurantGate from '../../components/dashboard/RestaurantGate'
import { errorResponse, jsonResponse, routeFetch } from '../helpers'
import { restaurantFixture } from './fixtures'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

describe('RestaurantGate', () => {
  it('shows a loading message while the restaurant loads', () => {
    routeFetch([{ match: '/restaurants', response: jsonResponse([restaurantFixture]) }])
    render(<RestaurantGate>{() => <p>contenido</p>}</RestaurantGate>)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('renders the children with the restaurant once loaded', async () => {
    routeFetch([{ match: '/restaurants', response: jsonResponse([restaurantFixture]) }])
    render(<RestaurantGate>{(r) => <p>{r.id}</p>}</RestaurantGate>)
    expect(await screen.findByText(restaurantFixture.id)).toBeInTheDocument()
  })

  it('invites the user to create a restaurant when there is none', async () => {
    routeFetch([{ match: '/restaurants', response: jsonResponse([]) }])
    render(<RestaurantGate>{() => <p>contenido</p>}</RestaurantGate>)
    expect(await screen.findByText(/Creá tu restaurante primero/)).toBeInTheDocument()
    expect(screen.queryByText('contenido')).not.toBeInTheDocument()
  })

  it('shows an alert when the restaurants fail to load', async () => {
    routeFetch([{ match: '/restaurants', response: errorResponse('x', 500) }])
    render(<RestaurantGate>{() => <p>contenido</p>}</RestaurantGate>)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus restaurantes.')
  })
})

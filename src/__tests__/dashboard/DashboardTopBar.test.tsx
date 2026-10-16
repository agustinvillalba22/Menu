import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DashboardTopBar from '../../components/dashboard/DashboardTopBar'
import { restaurantFixture, shiftFixture } from './fixtures'

function renderBar(
  props: Partial<React.ComponentProps<typeof DashboardTopBar>> = {},
  path = '/dashboard',
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardTopBar
        restaurant={restaurantFixture}
        currentShift={null}
        roleLabel="Administrador"
        onOpenNav={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('DashboardTopBar', () => {
  it('shows breadcrumbs with the restaurant name and the section for the route', () => {
    renderBar({}, '/dashboard/orders')
    expect(screen.getByText('Boulette')).toBeInTheDocument()
    expect(screen.getByText('Comandas')).toBeInTheDocument()
  })

  it.each([
    ['/dashboard', 'Inicio'],
    ['/dashboard/menu', 'Mi menú'],
    ['/dashboard/shifts', 'Turnos'],
    ['/dashboard/stock', 'Stock de mercadería'],
    ['/dashboard/suppliers', 'Proveedores'],
    ['/dashboard/staff', 'Usuarios y roles'],
    ['/dashboard/info', 'Mi restaurante'],
  ])('maps %s to "%s"', (path, label) => {
    renderBar({}, path)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows the open shift start time', () => {
    renderBar({ currentShift: shiftFixture() })
    expect(screen.getByText('Turno: 18:30 hs')).toBeInTheDocument()
  })

  it('shows "Sin turno abierto" without a shift', () => {
    renderBar()
    expect(screen.getByText('Sin turno abierto')).toBeInTheDocument()
  })

  it('shows "Recepción activa" when orders are enabled', () => {
    renderBar()
    expect(screen.getByText('Recepción activa')).toBeInTheDocument()
  })

  it('shows "Pedidos pausados" when orders are disabled', () => {
    renderBar({ restaurant: { ...restaurantFixture, orders_enabled: false } })
    expect(screen.getByText('Pedidos pausados')).toBeInTheDocument()
  })

  it('shows the user role', () => {
    renderBar()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
  })

  it('links "Ver Menú Cliente" to the public menu in a new tab', () => {
    renderBar()
    const link = screen.getByRole('link', { name: /Ver Menú Cliente/ })
    expect(link).toHaveAttribute('href', '/menu/qr-abc')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not offer "Cambiar a Mozo"', () => {
    renderBar()
    expect(screen.queryByText(/Cambiar a/)).not.toBeInTheDocument()
  })

  it('omits the menu link without a restaurant', () => {
    renderBar({ restaurant: null })
    expect(screen.queryByRole('link', { name: /Ver Menú Cliente/ })).not.toBeInTheDocument()
  })

  it('opens the nav drawer from the hamburger button', async () => {
    const onOpenNav = vi.fn()
    renderBar({ onOpenNav })
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }))
    expect(onOpenNav).toHaveBeenCalled()
  })
})

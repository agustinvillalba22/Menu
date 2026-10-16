import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DashboardSidebar from '../../components/dashboard/DashboardSidebar'
import type { DashboardSummary } from '../../hooks/useDashboardSummary'
import { shiftFixture } from './fixtures'

const emptySummary: DashboardSummary = {
  pendingOrders: 0,
  occupiedTables: 0,
  lowStock: 0,
  lowStockItems: [],
  currentShift: null,
}

function renderSidebar(
  props: Partial<React.ComponentProps<typeof DashboardSidebar>> = {},
  path = '/dashboard',
) {
  const onLogout = vi.fn()
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardSidebar
        userName="Test User"
        role="owner"
        summary={emptySummary}
        onLogout={onLogout}
        open={false}
        onNavigate={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )
  return { ...utils, onLogout }
}

describe('DashboardSidebar', () => {
  it('renders the brand block with the version from package.json', () => {
    renderSidebar()
    expect(screen.getByText('GastroSuite')).toBeInTheDocument()
    expect(screen.getByText('Gestión Gastronómica')).toBeInTheDocument()
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument()
  })

  it('renders the five groups', () => {
    renderSidebar()
    for (const title of ['Menú digital', 'Operación', 'Gestión', 'Análisis', 'Perfil']) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('links every real entry to its route with the new labels', () => {
    renderSidebar()
    const expected: Array<[string, string]> = [
      ['Inicio', '/dashboard'],
      ['Mi menú', '/dashboard/menu'],
      ['Promos', '/dashboard/promos'],
      ['Apariencia', '/dashboard/appearance'],
      ['Mi restaurante', '/dashboard/info'],
      ['Mesas', '/dashboard/tables'],
      ['Comandas', '/dashboard/orders'],
      ['Turnos', '/dashboard/shifts'],
      ['Stock de mercadería', '/dashboard/stock'],
      ['Proveedores', '/dashboard/suppliers'],
      ['Usuarios y roles', '/dashboard/staff'],
    ]
    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', href)
    }
  })

  it('does not keep the old labels', () => {
    renderSidebar()
    for (const old of ['Pedidos', 'Caja', 'Equipo', 'Información']) {
      expect(screen.queryByRole('link', { name: old })).not.toBeInTheDocument()
    }
  })

  it('renders coming-soon entries disabled and not as links', async () => {
    renderSidebar()
    for (const label of [
      'Distribución del local',
      'Pasarela de pagos',
      'Estadísticas de pedidos',
      'Perfil y turno',
    ]) {
      const btn = screen.getByRole('button', { name: new RegExp(label) })
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByRole('link', { name: new RegExp(label) })).not.toBeInTheDocument()
      expect(within(btn).getByText('Pronto')).toBeInTheDocument()
    }
  })

  it('marks the active link', () => {
    renderSidebar({}, '/dashboard/orders')
    expect(screen.getByRole('link', { name: /Comandas/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
  })

  it('shows badges only when the count is greater than zero', () => {
    const { unmount } = renderSidebar()
    expect(screen.queryByText(/activas/)).not.toBeInTheDocument()
    expect(screen.queryByText(/pendientes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/bajo/)).not.toBeInTheDocument()
    unmount()

    renderSidebar({
      summary: { ...emptySummary, occupiedTables: 3, pendingOrders: 2, lowStock: 4 },
    })
    expect(screen.getByText('3 activas')).toBeInTheDocument()
    expect(screen.getByText('2 pendientes')).toBeInTheDocument()
    expect(screen.getByText('4 bajo')).toBeInTheDocument()
  })

  it('shows "En servicio" with an open shift and "Sin turno" otherwise', () => {
    const { unmount } = renderSidebar()
    expect(screen.getByText('Sin turno')).toBeInTheDocument()
    unmount()
    renderSidebar({ summary: { ...emptySummary, currentShift: shiftFixture() } })
    expect(screen.getByText('En servicio')).toBeInTheDocument()
  })

  it('replaces owner-only config links with a notice for editors', () => {
    renderSidebar({ role: 'editor' })
    expect(screen.getByText('Configuración exclusiva para administradores.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Apariencia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mi restaurante' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi menú' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Comandas/ })).toBeInTheDocument()
  })

  it('shows the user box with initials and role', () => {
    renderSidebar()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('TU')).toBeInTheDocument()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
  })

  it('shows "Editor" for editors', () => {
    renderSidebar({ role: 'editor' })
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('calls onLogout from "Cerrar sesión"', async () => {
    const { onLogout } = renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('includes the compact theme selector', () => {
    renderSidebar()
    expect(screen.getByRole('button', { name: 'Oscuro' })).toBeInTheDocument()
  })

  it('calls onNavigate when a link is clicked', async () => {
    const onNavigate = vi.fn()
    renderSidebar({ onNavigate })
    await userEvent.click(screen.getByRole('link', { name: 'Promos' }))
    expect(onNavigate).toHaveBeenCalled()
  })
})

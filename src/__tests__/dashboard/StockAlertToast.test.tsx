import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StockAlertToast from '../../components/dashboard/StockAlertToast'
import type { StockItem } from '../../lib/types'
import { stockFixture } from './fixtures'

function renderToast(items: StockItem[]) {
  return render(
    <MemoryRouter>
      <StockAlertToast items={items} />
    </MemoryRouter>,
  )
}

const low = stockFixture({ id: 'a', name: 'Sal', quantity: '0', min_threshold: '1' })
const low2 = stockFixture({ id: 'b', name: 'Harina', quantity: '1', min_threshold: '2' })

beforeEach(() => window.sessionStorage.clear())

describe('StockAlertToast', () => {
  it('renders nothing without low-stock items', () => {
    renderToast([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the alert with count, critical count and chip', () => {
    renderToast([low, low2])
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Alerta de Stock Mínimo')).toBeInTheDocument()
    expect(screen.getByText('2 productos')).toBeInTheDocument()
    expect(screen.getByText('1 en nivel crítico de reposición')).toBeInTheDocument()
    expect(screen.getByText(/y otros/)).toHaveTextContent('Sal y otros 1 insumos')
    expect(screen.getByText(/: 1\/2 kg/)).toHaveTextContent('Harina: 1/2 kg')
  })

  it('uses singular for one product', () => {
    renderToast([low2])
    expect(screen.getByText('1 producto')).toBeInTheDocument()
  })

  it('links to the stock page', () => {
    renderToast([low])
    expect(screen.getByRole('link', { name: /Gestionar Stock/ })).toHaveAttribute('href', '/dashboard/stock')
  })

  it('closes and stays closed after remount while the low-stock set is unchanged', async () => {
    const { unmount } = renderToast([low, low2])
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    unmount()

    renderToast([low2, low])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reappears when the low-stock set changes', async () => {
    const { unmount } = renderToast([low])
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
    unmount()

    renderToast([low, low2])
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

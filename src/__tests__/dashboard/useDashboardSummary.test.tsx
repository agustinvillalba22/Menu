import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDashboardSummary } from '../../hooks/useDashboardSummary'
import * as orders from '../../lib/orders'
import * as shifts from '../../lib/shifts'
import * as stockItems from '../../lib/stockItems'
import type { OrderStatus } from '../../lib/types'
import { orderFixture, shiftFixture, stockFixture } from './fixtures'

vi.mock('../../lib/orders')
vi.mock('../../lib/shifts')
vi.mock('../../lib/stockItems')

function mockOrders(byStatus: Partial<Record<OrderStatus, ReturnType<typeof orderFixture>[]>>): void {
  vi.mocked(orders.listOrders).mockImplementation(async (_id, status) =>
    status ? (byStatus[status] ?? []) : [],
  )
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  mockOrders({})
  vi.mocked(shifts.getCurrentShift).mockResolvedValue(null)
  vi.mocked(stockItems.listStockItems).mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('useDashboardSummary', () => {
  it('counts pending orders', async () => {
    mockOrders({ pending: [orderFixture({ id: 'a' }), orderFixture({ id: 'b' })] })
    const { result } = renderHook(() => useDashboardSummary('r1'))
    await flush()
    expect(result.current.pendingOrders).toBe(2)
  })

  it('counts occupied tables as distinct table_id across pending/accepted/ready', async () => {
    mockOrders({
      pending: [orderFixture({ id: 'a', table_id: 't1' }), orderFixture({ id: 'b', table_id: 't1' })],
      accepted: [orderFixture({ id: 'c', status: 'accepted', table_id: 't2' })],
      ready: [orderFixture({ id: 'd', status: 'ready', table_id: null })],
    })
    const { result } = renderHook(() => useDashboardSummary('r1'))
    await flush()
    expect(result.current.occupiedTables).toBe(2)
  })

  it('computes low stock with quantity <= min_threshold', async () => {
    vi.mocked(stockItems.listStockItems).mockResolvedValue([
      stockFixture({ id: 'a', quantity: '1', min_threshold: '2' }),
      stockFixture({ id: 'b', quantity: '2', min_threshold: '2' }),
      stockFixture({ id: 'c', quantity: '9', min_threshold: '2' }),
    ])
    const { result } = renderHook(() => useDashboardSummary('r1'))
    await flush()
    expect(result.current.lowStock).toBe(2)
    expect(result.current.lowStockItems.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('exposes the current shift', async () => {
    const shift = shiftFixture()
    vi.mocked(shifts.getCurrentShift).mockResolvedValue(shift)
    const { result } = renderHook(() => useDashboardSummary('r1'))
    await flush()
    expect(result.current.currentShift).toEqual(shift)
  })

  it('refreshes every 30 seconds', async () => {
    const { result } = renderHook(() => useDashboardSummary('r1'))
    await flush()
    expect(result.current.pendingOrders).toBe(0)

    mockOrders({ pending: [orderFixture()] })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current.pendingOrders).toBe(1)
  })

  it('stops polling on unmount', async () => {
    const { unmount } = renderHook(() => useDashboardSummary('r1'))
    await flush()
    unmount()
    vi.mocked(shifts.getCurrentShift).mockClear()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })
    expect(shifts.getCurrentShift).not.toHaveBeenCalled()
  })

  it('tolerates network errors without throwing and keeps zero counts', async () => {
    vi.mocked(orders.listOrders).mockRejectedValue(new Error('net'))
    vi.mocked(shifts.getCurrentShift).mockRejectedValue(new Error('net'))
    vi.mocked(stockItems.listStockItems).mockRejectedValue(new Error('net'))
    const { result } = renderHook(() => useDashboardSummary('r1'))
    await flush()
    expect(result.current).toMatchObject({ pendingOrders: 0, occupiedTables: 0, lowStock: 0, currentShift: null })
  })

  it('does not query orders when orders are disabled', async () => {
    renderHook(() => useDashboardSummary('r1', false))
    await flush()
    expect(orders.listOrders).not.toHaveBeenCalled()
    expect(stockItems.listStockItems).toHaveBeenCalled()
  })

  it('does not fetch anything without a restaurant', async () => {
    renderHook(() => useDashboardSummary(null))
    await flush()
    expect(orders.listOrders).not.toHaveBeenCalled()
    expect(shifts.getCurrentShift).not.toHaveBeenCalled()
    expect(stockItems.listStockItems).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useRestaurantData } from '../../hooks/useRestaurantData'

const INITIAL: string[] = []
const ERROR = 'No se pudo cargar.'

describe('useRestaurantData', () => {
  it('starts loading, then exposes the loaded data', async () => {
    const load = vi.fn().mockResolvedValue(['a'])
    const { result } = renderHook(() => useRestaurantData('r1', load, INITIAL, ERROR))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(['a'])
    expect(result.current.error).toBeNull()
    expect(load).toHaveBeenCalledWith('r1')
  })

  it('exposes the error message and the initial data when the load fails', async () => {
    const load = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useRestaurantData('r1', load, INITIAL, ERROR))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(ERROR)
    expect(result.current.data).toBe(INITIAL)
  })

  it('setData updates the data locally without refetching', async () => {
    const load = vi.fn().mockResolvedValue(['a'])
    const { result } = renderHook(() => useRestaurantData('r1', load, INITIAL, ERROR))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setData((prev) => [...prev, 'b']))

    expect(result.current.data).toEqual(['a', 'b'])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reloads and shows loading again when the restaurant changes', async () => {
    const load = vi.fn().mockImplementation(async (id: string) => [id])
    const { result, rerender } = renderHook(
      ({ id }) => useRestaurantData(id, load, INITIAL, ERROR),
      { initialProps: { id: 'r1' } },
    )
    await waitFor(() => expect(result.current.data).toEqual(['r1']))

    rerender({ id: 'r2' })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toEqual(['r2']))
  })
})

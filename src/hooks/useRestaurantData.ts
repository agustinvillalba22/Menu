import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

interface Loaded<T> {
  restaurantId: string | null
  data: T
  error: string | null
}

interface UseRestaurantDataResult<T> {
  data: T
  setData: Dispatch<SetStateAction<T>>
  loading: boolean
  error: string | null
}

/**
 * Loads one restaurant-scoped resource on mount (and when the restaurant
 * changes). `load` and `initial` must be referentially stable (module-level
 * constants or memoized), since they feed the effect. `setData` is for local
 * updates after create/edit/delete so the page doesn't refetch.
 */
export function useRestaurantData<T>(
  restaurantId: string,
  load: (restaurantId: string) => Promise<T>,
  initial: T,
  errorMessage: string,
): UseRestaurantDataResult<T> {
  const [state, setState] = useState<Loaded<T>>({ restaurantId: null, data: initial, error: null })

  useEffect(() => {
    let cancelled = false
    load(restaurantId)
      .then((data) => {
        if (!cancelled) setState({ restaurantId, data, error: null })
      })
      .catch(() => {
        if (!cancelled) setState({ restaurantId, data: initial, error: errorMessage })
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, load, initial, errorMessage])

  const setData: Dispatch<SetStateAction<T>> = (update) =>
    setState((prev) => ({
      ...prev,
      data: typeof update === 'function' ? (update as (prev: T) => T)(prev.data) : update,
    }))

  return { data: state.data, setData, loading: state.restaurantId !== restaurantId, error: state.error }
}

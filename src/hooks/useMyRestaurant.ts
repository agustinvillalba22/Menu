import { useCallback, useEffect, useState } from 'react'
import { listRestaurants } from '../lib/restaurants'
import type { Restaurant } from '../lib/types'

interface UseMyRestaurantResult {
  restaurant: Restaurant | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * MVP assumption (RNF-03): a user owns at most one relevant restaurant, so the
 * first item of `listRestaurants()` is the single source of truth. Shared by
 * OverviewPage and AppearancePage to avoid duplicating the fetch logic.
 */
export function useMyRestaurant(): UseMyRestaurantResult {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const list = await listRestaurants()
      setRestaurant(list.length > 0 ? list[0] : null)
    } catch {
      setError('No se pudieron cargar tus restaurantes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { restaurant, loading, error, reload }
}

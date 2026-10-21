import React from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import type { Restaurant } from '../../lib/types'

interface RestaurantGateProps {
  children: (restaurant: Restaurant) => React.ReactNode
}

/**
 * Resolves the user's restaurant and renders the shared loading / error /
 * "no restaurant yet" states, so each dashboard page only handles its own data.
 */
export default function RestaurantGate({ children }: RestaurantGateProps): React.JSX.Element {
  const { restaurant, loading, error } = useMyRestaurant()

  if (loading) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Creá tu restaurante primero desde “Mi restaurante”.
      </p>
    )
  }

  return <>{children(restaurant)}</>
}

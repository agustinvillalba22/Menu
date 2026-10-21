import React from 'react'
import type { OrderRead } from '../../../lib/types'
import { formatMoney } from '../../../lib/tableUi'

export default function TableOrders({ orders }: { orders: OrderRead[] }): React.JSX.Element {
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li
          key={o.id}
          className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-800/50"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(o.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {o.customer_name}
          </p>
          <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-700">
            {o.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-2 py-1">
                <div className="min-w-0">
                  <p className="text-gray-900 dark:text-gray-100">
                    {it.quantity}× {it.name_snapshot}
                  </p>
                  {it.modifiers.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {it.modifiers.map((m) => m.name_snapshot).join(', ')}
                    </p>
                  )}
                  {it.special_instructions && (
                    <p className="text-xs italic text-orange-700 dark:text-orange-400">
                      Nota: {it.special_instructions}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-medium text-gray-900 dark:text-gray-100">
                  {formatMoney(it.subtotal)}
                </span>
              </li>
            ))}
          </ul>
          {o.notes && (
            <p className="mt-1 text-xs italic text-orange-700 dark:text-orange-400">Nota: {o.notes}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

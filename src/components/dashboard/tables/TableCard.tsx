import React from 'react'
import type { TableOccupancy } from '../../../lib/types'
import { elapsedLabel, formatMoney, STATUS_META } from '../../../lib/tableUi'

interface TableCardProps {
  table: TableOccupancy
  selected: boolean
  now: number
  onSelect: (id: string) => void
}

export default function TableCard({ table, selected, now, onSelect }: TableCardProps): React.JSX.Element {
  const meta = STATUS_META[table.status]
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(table.id)}
      className={`flex min-h-32 flex-col rounded-xl border bg-white p-3 text-left dark:bg-gray-900 ${
        selected
          ? 'border-gray-900 ring-1 ring-gray-900 dark:border-gray-100 dark:ring-gray-100'
          : 'border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500'
      }`}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
          Mesa {table.number}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${meta.badge}`}
        >
          {meta.label}
        </span>
      </span>
      {table.capacity !== null && (
        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{table.capacity} pax</span>
      )}
      {table.status !== 'free' && (
        <span className="mt-auto flex w-full items-end justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
          <span>
            <span className="block text-[10px] uppercase text-gray-400">Consumo:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatMoney(table.total)}
            </span>
          </span>
          {table.first_order_at && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {elapsedLabel(table.first_order_at, now)}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

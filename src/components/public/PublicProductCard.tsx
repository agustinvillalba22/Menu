import React from 'react'
import { Plus, ImageOff } from 'lucide-react'
import type { PublicItem } from '../../lib/types'
import { badgeEmoji } from './badges'

interface PublicProductCardProps {
  item: PublicItem
  orderingEnabled: boolean
  onSelect: (item: PublicItem) => void
}

/**
 * Public menu product card. Ports the small-card look & feel from the mock
 * ProductCard but binds to real `PublicItem` data (string price, image_url,
 * tag-derived badges). The quick-add button only renders when ordering is on.
 */
export default function PublicProductCard({
  item,
  orderingEnabled,
  onSelect,
}: PublicProductCardProps): React.JSX.Element {
  const handleAdd = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onSelect(item)
  }

  return (
    <div
      id={`product-card-${item.id}`}
      data-testid={`product-card-${item.id}`}
      onClick={() => onSelect(item)}
      className="group relative flex cursor-pointer gap-4 rounded-[28px] border border-gray-100 bg-white p-4 transition-all duration-300 hover:shadow-xs active:scale-[0.99] select-none"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between pr-2">
        <div>
          <h4 className="truncate text-[15px] font-black leading-tight text-gray-900 transition-colors group-hover:text-primario">
            {item.name}
          </h4>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-[10.5px] font-medium leading-relaxed text-gray-400">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-black text-primario">
            ${parseFloat(item.price).toFixed(2)}
          </span>
          {item.tags.length > 0 && (
            <ul className="flex flex-wrap items-center gap-1">
              {item.tags.map((tag) => {
                const emoji = badgeEmoji(tag)
                return (
                  <li
                    key={tag.id}
                    className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9px] font-black text-gray-600"
                  >
                    {emoji && (
                      <span aria-hidden="true" className="leading-none">
                        {emoji}
                      </span>
                    )}
                    <span>{tag.name}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[20px] border border-gray-50 bg-gray-50">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImageOff className="h-6 w-6" />
          </div>
        )}

        {orderingEnabled && (
          <div className="absolute bottom-1 right-1">
            <button
              type="button"
              id={`btn-add-quick-${item.id}`}
              aria-label={`Agregar ${item.name}`}
              onClick={handleAdd}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-primario text-white shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3.5] text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

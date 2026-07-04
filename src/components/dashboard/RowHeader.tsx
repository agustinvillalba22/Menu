import React from 'react'

interface RowHeaderProps {
  inputId: string
  label: string
  name: string
  badge?: React.ReactNode
  expanded: boolean
  onToggleExpand: () => void
  editing: boolean
  draftName: string
  onDraftChange: (value: string) => void
  onStartEdit: () => void
  onSaveName: () => void
  onCancelEdit: () => void
  onDelete: () => void
  busy: boolean
  padding: string
  nameClassName: string
}

/**
 * Shared editable header for CategoryRow and SubcategoryRow: expand toggle,
 * inline name edit, optional badge, and edit/save/cancel/delete controls.
 */
export default function RowHeader({
  inputId,
  label,
  name,
  badge,
  expanded,
  onToggleExpand,
  editing,
  draftName,
  onDraftChange,
  onStartEdit,
  onSaveName,
  onCancelEdit,
  onDelete,
  busy,
  padding,
  nameClassName,
}: RowHeaderProps): React.JSX.Element {
  return (
    <div className={`flex items-center justify-between gap-2 ${padding}`}>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          {expanded ? '▾' : '▸'}
        </button>
        {editing ? (
          <>
            <label htmlFor={inputId} className="sr-only">
              {label}
            </label>
            <input
              id={inputId}
              type="text"
              value={draftName}
              onChange={(e) => onDraftChange(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
            />
          </>
        ) : (
          <span className={`truncate ${nameClassName}`}>{name}</span>
        )}
        {badge}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={onSaveName}
              disabled={busy}
              className="text-xs font-medium text-gray-900 hover:underline disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onStartEdit}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Borrar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

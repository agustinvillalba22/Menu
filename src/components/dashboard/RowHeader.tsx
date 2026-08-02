import React from 'react'
import RowActions from './RowActions'

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
  /** Message shown while confirming delete — must mention cascade for category/subcategory. */
  deleteConfirmMessage: string
  /**
   * Optional extra controls rendered inline next to the name input while
   * editing. Used by CategoryRow (P8) to host the icon select without
   * forcing every consumer (SubcategoryRow) to pass children.
   */
  editExtras?: React.ReactNode
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
  deleteConfirmMessage,
  editExtras,
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
            {editExtras}
          </>
        ) : (
          <span className={`truncate ${nameClassName}`}>{name}</span>
        )}
        {badge}
      </div>
      <RowActions
        editing={editing}
        busy={busy}
        onStartEdit={onStartEdit}
        onSave={onSaveName}
        onCancelEdit={onCancelEdit}
        onDelete={onDelete}
        deleteConfirmMessage={deleteConfirmMessage}
      />
    </div>
  )
}

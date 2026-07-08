import React, { useState } from 'react'

interface RowActionsProps {
  editing: boolean
  busy: boolean
  onStartEdit: () => void
  onSave: () => void
  onCancelEdit: () => void
  onDelete: () => void
  /** Shown inline in place of Editar/Borrar while the user confirms deletion. */
  deleteConfirmMessage: string
}

/**
 * Shared action controls (Editar/Guardar/Cancelar/Borrar) used by CategoryRow,
 * SubcategoryRow (via RowHeader) and ItemRow, so the three levels look the
 * same regardless of how different their editable fields are.
 *
 * Delete is never immediate: clicking "Borrar" swaps the controls in-place
 * for a confirmation message with "Sí, borrar" / "Cancelar" — only the first
 * calls `onDelete`.
 */
export default function RowActions({
  editing,
  busy,
  onStartEdit,
  onSave,
  onCancelEdit,
  onDelete,
  deleteConfirmMessage,
}: RowActionsProps): React.JSX.Element {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (confirmingDelete) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-gray-600">{deleteConfirmMessage}</span>
        <button
          type="button"
          onClick={() => {
            setConfirmingDelete(false)
            onDelete()
          }}
          disabled={busy}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sí, borrar
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(false)}
          disabled={busy}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={busy}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onStartEdit}
        className="text-xs text-gray-500 hover:text-gray-900"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={() => setConfirmingDelete(true)}
        disabled={busy}
        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Borrar
      </button>
    </div>
  )
}

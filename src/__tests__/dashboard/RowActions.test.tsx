import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RowActions from '../../components/dashboard/RowActions'

/**
 * RowActions is the single shared implementation of Editar/Guardar/Cancelar/
 * Borrar used by CategoryRow, SubcategoryRow (via RowHeader) and ItemRow.
 * Testing it directly is the source of truth for CA-01, CA-02 and CA-06 —
 * every row-level test that renders the real components on top of it only
 * needs to confirm the wiring, not re-derive this behavior.
 */
describe('RowActions', () => {
  function renderActions(onDelete = vi.fn()) {
    render(
      <RowActions
        editing={false}
        busy={false}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onCancelEdit={vi.fn()}
        onDelete={onDelete}
        deleteConfirmMessage="Se borrará también todo lo que contiene. ¿Confirmar?"
      />,
    )
    return onDelete
  }

  // CA-01: clicking "Borrar" does not call onDelete immediately — it swaps
  // in an inline confirmation. Only "Sí, borrar" calls onDelete.
  it('does not call onDelete until the confirmation is accepted', async () => {
    const onDelete = renderActions()

    expect(screen.queryByText(/¿confirmar\?/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText(/se borrará también todo lo que contiene/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  // CA-02: cancelling the confirmation never calls onDelete, and the normal
  // Editar/Borrar controls come back.
  it('cancelling the delete confirmation restores the normal controls without deleting', async () => {
    const onDelete = renderActions()

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }))
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^borrar$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^editar$/i })).toBeInTheDocument()
  })

  // CA-06: the "Borrar" control always uses the same red, same-weight classes.
  it('renders "Borrar" with the fixed red/medium-weight treatment', () => {
    renderActions()
    const deleteButton = screen.getByRole('button', { name: /^borrar$/i })
    expect(deleteButton.className).toBe(
      'text-xs font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50',
    )
  })

  it('is keyboard-operable: Enter on the delete button opens confirmation, Enter on "Sí, borrar" deletes', async () => {
    const onDelete = renderActions()

    screen.getByRole('button', { name: /^borrar$/i }).focus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('button', { name: /sí, borrar/i })).toBeInTheDocument()

    screen.getByRole('button', { name: /sí, borrar/i }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

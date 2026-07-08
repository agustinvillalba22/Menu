import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminUsersPage from '../../pages/admin/AdminUsersPage'
import type { AdminUser } from '../../lib/types'
import { jsonResponse, readCall, routeFetch } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const alice: AdminUser = {
  id: 'u1',
  email: 'alice@example.com',
  full_name: 'Alice',
  is_active: true,
  is_superadmin: false,
  created_at: '2026-01-01T00:00:00Z',
}

function callsMatching(fragment: string, method?: string) {
  return vi
    .mocked(fetch)
    .mock.calls.map((c) => readCall(c as [unknown, unknown]))
    .filter((c) => c.url.includes(fragment) && (method ? c.method === method : true))
}

describe('AdminUsersPage', () => {
  it('renders a table with users, their email/name and active/superadmin toggles', async () => {
    routeFetch([{ method: 'GET', match: '/admin/users', response: jsonResponse([alice]) }])

    render(<AdminUsersPage />)

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    const row = screen.getByText('alice@example.com').closest('tr') as HTMLElement
    expect(within(row).getAllByRole('switch')).toHaveLength(2)
  })

  // CA-03: toggling is_superadmin PATCHes /admin/users/{id} with only that field.
  it('toggling is_superadmin PATCHes with {is_superadmin: true} only', async () => {
    routeFetch([
      { method: 'GET', match: '/admin/users', response: jsonResponse([alice]) },
      {
        method: 'PATCH',
        match: '/admin/users/u1',
        response: jsonResponse({ ...alice, is_superadmin: true }),
      },
    ])

    render(<AdminUsersPage />)

    const row = (await screen.findByText('alice@example.com')).closest('tr') as HTMLElement
    const superadminSwitch = within(row).getByRole('switch', { name: /superadmin/i })
    expect(superadminSwitch).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(superadminSwitch)

    const patches = callsMatching('/admin/users/u1', 'PATCH')
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0].body as string)).toEqual({ is_superadmin: true })
  })

  it('toggling is_active PATCHes with {is_active: false} only', async () => {
    routeFetch([
      { method: 'GET', match: '/admin/users', response: jsonResponse([alice]) },
      {
        method: 'PATCH',
        match: '/admin/users/u1',
        response: jsonResponse({ ...alice, is_active: false }),
      },
    ])

    render(<AdminUsersPage />)

    const row = (await screen.findByText('alice@example.com')).closest('tr') as HTMLElement
    const activeSwitch = within(row).getByRole('switch', { name: /^activo/i })
    await userEvent.click(activeSwitch)

    const patches = callsMatching('/admin/users/u1', 'PATCH')
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0].body as string)).toEqual({ is_active: false })
  })

  it('shows an error state when the list fails to load', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server error',
      json: async () => ({ detail: 'boom' }),
      text: async () => JSON.stringify({ detail: 'boom' }),
    } as unknown as Response)

    render(<AdminUsersPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

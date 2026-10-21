import React from 'react'
import { NavLink } from 'react-router-dom'

type IconType = React.ComponentType<{ className?: string }>

const itemBase = 'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors'

interface SidebarNavItemProps {
  to: string
  label: string
  icon: IconType
  end?: boolean
  badge?: React.ReactNode
  /** Amber icon when the badge signals a warning (low stock). */
  warn?: boolean
  onNavigate?: () => void
}

/** Real, navigable entry. Active state mirrors the prototype (black pill, amber icon). */
export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  end,
  badge,
  warn,
  onNavigate,
}: SidebarNavItemProps): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${itemBase} justify-between ${
          isActive
            ? 'bg-neutral-900 font-medium text-white shadow-xs dark:bg-neutral-100 dark:text-neutral-900'
            : 'text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex min-w-0 items-center gap-2.5">
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                isActive
                  ? 'text-amber-400 dark:text-amber-600'
                  : warn
                    ? 'text-amber-600 dark:text-amber-500'
                    : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'
              }`}
              aria-hidden="true"
            />
            <span className="truncate">{label}</span>
          </span>
          {badge}
        </>
      )}
    </NavLink>
  )
}

/** Entry without backend yet: visible, disabled, never focusable or navigable. */
export function SidebarSoonItem({ label, icon: Icon }: { label: string; icon: IconType }): React.JSX.Element {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Próximamente"
      className={`${itemBase} cursor-not-allowed justify-between text-neutral-400 opacity-70 dark:text-neutral-500`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 rounded border border-neutral-200 bg-neutral-100 px-1.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
        Pronto
      </span>
    </button>
  )
}

export function SidebarGroup({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
          {title}
        </span>
        {right}
      </div>
      <nav aria-label={title} className="space-y-0.5">
        {children}
      </nav>
    </div>
  )
}

export function OwnerOnlyNotice({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[10px] leading-snug text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      {children}
    </div>
  )
}

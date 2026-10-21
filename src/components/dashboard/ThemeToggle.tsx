import React from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '../../hooks/useTheme'

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

/** Light/dark/system selector, compact version for the sidebar footer. */
export default function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Tema del dashboard"
      className="mt-2 grid grid-cols-3 gap-0.5 rounded-lg border border-neutral-200/90 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={label}
            onClick={() => setTheme(value)}
            className={`flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[10px] font-medium transition-colors ${
              active
                ? 'bg-neutral-900 text-white shadow-xs dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
            }`}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

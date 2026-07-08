import React from 'react'

interface ToggleProps {
  checked: boolean
  label: string
  disabled?: boolean
  onToggle: () => void
}

/**
 * Accessible switch, visually and semantically matching the `orders_enabled`
 * toggle in `OverviewPage.tsx` (RNF-03) — same `role="switch"`/`aria-checked`
 * pattern, reused here instead of re-implemented per admin page.
 */
export default function Toggle({
  checked,
  label,
  disabled = false,
  onToggle,
}: ToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
        checked ? 'bg-gray-900' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

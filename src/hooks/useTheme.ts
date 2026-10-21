import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'menu_dashboard_theme'

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme
}

function applyToDocument(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

interface UseThemeResult {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

/** Dashboard-only theme preference (light/dark/system),
 * persisted in localStorage. "system" tracks the OS preference live. */
export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(theme))

  useEffect(() => {
    const next = resolve(theme)
    setResolvedTheme(next)
    applyToDocument(next)

    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      const liveResolved = systemPrefersDark() ? 'dark' : 'light'
      setResolvedTheme(liveResolved)
      applyToDocument(liveResolved)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      if (next === 'system') {
        window.localStorage.removeItem(STORAGE_KEY)
      } else {
        window.localStorage.setItem(STORAGE_KEY, next)
      }
    } catch {
      // Storage unavailable (private mode, quota) — the in-memory state still
      // drives this session's UI, it just won't persist across reloads.
    }
  }, [])

  return { theme, resolvedTheme, setTheme }
}

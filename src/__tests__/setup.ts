import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom doesn't implement matchMedia — M16's useTheme (and anything else
// reading `prefers-color-scheme`) needs it to exist. Defaults to "no
// preference matched" (light); individual tests override via
// `vi.mocked(window.matchMedia)` for dark-mode assertions.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Unmount React trees between tests so DOM/global state (e.g. any CSS var a
// component might set) never leaks across cases — this is load-bearing for the
// theming-isolation assertions (CA-07 / CA-08).
afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
  try {
    window.localStorage.removeItem('menu_dashboard_theme')
  } catch {
    // ignore — storage not available in this environment
  }
})

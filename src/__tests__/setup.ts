import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount React trees between tests so DOM/global state (e.g. any CSS var a
// component might set) never leaks across cases — this is load-bearing for the
// theming-isolation assertions (CA-07 / CA-08).
afterEach(() => {
  cleanup()
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')

describe('index.css dark mode form controls (M31)', () => {
  it('sets color-scheme: dark on .dark .dashboard-root', () => {
    expect(css).toMatch(/\.dark \.dashboard-root\s*\{[^}]*color-scheme:\s*dark/)
  })

  it('scopes input, select and textarea rules to .dark .dashboard-root', () => {
    for (const tag of ['input', 'select', 'textarea']) {
      expect(css).toMatch(new RegExp(`\\.dark \\.dashboard-root[^{]*\\b${tag}\\b`))
    }
  })

  it('excludes checkbox, radio, range, color and file inputs', () => {
    for (const t of ['checkbox', 'radio', 'range', 'color', 'file']) {
      expect(css).toContain(`:not([type=${t}])`)
    }
  })

  it('lives in @layer base without :where() (preflight would out-specify it)', () => {
    const block = css.slice(css.indexOf('/* M31'))
    expect(block).toContain('@layer base')
    expect(block).not.toMatch(/:where\(/)
  })
})

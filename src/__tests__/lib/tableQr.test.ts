import { describe, expect, it } from 'vitest'
import { tableMenuUrl, parseTableParam } from '../../lib/tableQr'

describe('tableMenuUrl', () => {
  it('builds the menu URL with the table number', () => {
    expect(tableMenuUrl('https://x.com', 'tok', 5)).toBe('https://x.com/menu/tok?mesa=5')
  })
  it('does not duplicate the slash when origin ends with /', () => {
    expect(tableMenuUrl('https://x.com/', 'tok', 12)).toBe('https://x.com/menu/tok?mesa=12')
  })
})

describe('parseTableParam', () => {
  it('accepts positive integers', () => {
    expect(parseTableParam('5')).toBe(5)
    expect(parseTableParam('12')).toBe(12)
  })
  it.each(['', 'abc', '5x', '-1', '0', '1.5', ' 5', '00'])('rejects %j', (v) => {
    expect(parseTableParam(v)).toBeNull()
  })
  it('rejects null', () => {
    expect(parseTableParam(null)).toBeNull()
  })
})

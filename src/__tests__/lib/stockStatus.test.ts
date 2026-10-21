import { describe, expect, it } from 'vitest'
import { isLowStock, isCriticalStock } from '../../lib/stockStatus'
import { stockFixture } from '../dashboard/fixtures'

describe('stockStatus', () => {
  it('flags quantity <= min_threshold as low', () => {
    expect(isLowStock(stockFixture({ quantity: '2.00', min_threshold: '2.00' }))).toBe(true)
    expect(isLowStock(stockFixture({ quantity: '1.00', min_threshold: '2.00' }))).toBe(true)
    expect(isLowStock(stockFixture({ quantity: '3.00', min_threshold: '2.00' }))).toBe(false)
  })

  it('flags quantity <= 0 as critical', () => {
    expect(isCriticalStock(stockFixture({ quantity: '0.00' }))).toBe(true)
    expect(isCriticalStock(stockFixture({ quantity: '1.00' }))).toBe(false)
  })

  it('does not flag unparsable quantities', () => {
    expect(isLowStock(stockFixture({ quantity: 'x' }))).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addOrderToken, getOrderTokens, removeOrderTokens } from '../../lib/orderTokens'

const H = 60 * 60 * 1000
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-07T10:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('orderTokens', () => {
  it('guarda y lee tokens por qrToken y mesa', () => {
    addOrderToken('q', 5, 'tok-a')
    expect(getOrderTokens('q', 5)).toEqual(['tok-a'])
    expect(getOrderTokens('otro', 5)).toEqual([])
  })

  it('vence a las 12 h', () => {
    addOrderToken('q', 5, 'tok-a')
    vi.advanceTimersByTime(11 * H)
    expect(getOrderTokens('q', 5)).toEqual(['tok-a'])
    vi.advanceTimersByTime(2 * H)
    expect(getOrderTokens('q', 5)).toEqual([])
  })

  it('tope de 20: descarta el más viejo', () => {
    for (let i = 0; i < 21; i++) addOrderToken('q', 5, `tok-${i}`)
    const t = getOrderTokens('q', 5)
    expect(t).toHaveLength(20)
    expect(t[0]).toBe('tok-1')
    expect(t[19]).toBe('tok-20')
  })

  it('ignora y descarta el valor guardado de otra mesa', () => {
    addOrderToken('q', 5, 'tok-a')
    expect(getOrderTokens('q', 6)).toEqual([])
    addOrderToken('q', 6, 'tok-b')
    expect(getOrderTokens('q', 5)).toEqual([])
    expect(getOrderTokens('q', 6)).toEqual(['tok-b'])
  })

  it('JSON corrupto se ignora y se reinicia', () => {
    localStorage.setItem('menu_orders_q', '{no-json')
    expect(getOrderTokens('q', 5)).toEqual([])
    addOrderToken('q', 5, 'tok-a')
    expect(getOrderTokens('q', 5)).toEqual(['tok-a'])
  })

  it('removeOrderTokens quita solo los indicados', () => {
    addOrderToken('q', 5, 'tok-a')
    addOrderToken('q', 5, 'tok-b')
    removeOrderTokens('q', ['tok-a'])
    expect(getOrderTokens('q', 5)).toEqual(['tok-b'])
  })

  it('localStorage que lanza no rompe', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => addOrderToken('q', 5, 'tok-a')).not.toThrow()
    expect(getOrderTokens('q', 5)).toEqual([])
    expect(() => removeOrderTokens('q', ['tok-a'])).not.toThrow()
  })
})

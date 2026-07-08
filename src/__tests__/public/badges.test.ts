import { describe, expect, it } from 'vitest'
import { badgeInfo } from '../../components/public/badges'
import type { PublicTag } from '../../lib/types'

function tag(name: string): PublicTag {
  return { id: 't1', name }
}

describe('badgeInfo', () => {
  // CA-05: vegetariano and vegano must render distinct emoji/color, not the
  // same badge as before this spec.
  it('distinguishes vegetariano from vegano with different emoji and color', () => {
    const vegetariano = badgeInfo(tag('Vegetariano'))
    const vegano = badgeInfo(tag('Vegano'))

    expect(vegetariano).not.toBeNull()
    expect(vegano).not.toBeNull()
    expect(vegetariano?.emoji).not.toBe(vegano?.emoji)
    expect(vegetariano?.colorClass).not.toBe(vegano?.colorClass)
  })

  // CA-06: "Sin lácteos" previously had no badge at all.
  it('assigns an emoji to "Sin lácteos"', () => {
    const badge = badgeInfo(tag('Sin lácteos'))
    expect(badge).not.toBeNull()
    expect(badge?.emoji).toBeTruthy()
    expect(badge?.colorClass).toBeTruthy()
  })

  it('also matches "sin lacteos" and "dairy free" case-insensitively (substring heuristic)', () => {
    expect(badgeInfo(tag('sin lacteos'))).not.toBeNull()
    expect(badgeInfo(tag('Dairy Free'))).not.toBeNull()
    expect(badgeInfo(tag('dairy-free'))).not.toBeNull()
  })

  // CA-07: unrecognized free-text tags fall back to no badge (gray chip).
  it('returns null for an unrecognized free-text tag', () => {
    expect(badgeInfo(tag('Nuevo'))).toBeNull()
  })

  it('keeps existing picante and sin TACC / gluten free rules working', () => {
    expect(badgeInfo(tag('Picante'))?.emoji).toBeTruthy()
    expect(badgeInfo(tag('Sin TACC'))?.emoji).toBeTruthy()
    expect(badgeInfo(tag('Gluten Free'))?.emoji).toBeTruthy()
  })

  it('still matches substrings on free-text variants (not exact-match only)', () => {
    expect(badgeInfo(tag('Vegano light'))).not.toBeNull()
    expect(badgeInfo(tag('Muy picante hoy'))).not.toBeNull()
  })

  it('every one of the 5 curated categories has a distinct colorClass', () => {
    const classes = new Set(
      ['Picante', 'Vegetariano', 'Vegano', 'Sin TACC', 'Sin lácteos'].map(
        (name) => badgeInfo(tag(name))?.colorClass,
      ),
    )
    expect(classes.size).toBe(5)
  })
})

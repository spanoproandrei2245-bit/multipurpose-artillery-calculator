import { describe, expect, it } from 'vitest'

import { formatSigned, isInvalid, numberToField, parseNumber } from './input'

describe('parseNumber', () => {
  it('accepts comma and the typographic minus', () => {
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber('−30')).toBe(-30)
    expect(parseNumber(' 7 ')).toBe(7)
  })

  it('returns null for empty or garbage input', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })

  it('marks only filled garbage as invalid', () => {
    expect(isInvalid('')).toBe(false)
    expect(isInvalid('12')).toBe(false)
    expect(isInvalid('12a')).toBe(true)
  })
})

describe('formatting', () => {
  it('adds a plus sign and avoids "-0.0"', () => {
    expect(formatSigned(3.14)).toBe('+3.1')
    expect(formatSigned(-2)).toBe('-2.0')
    expect(formatSigned(-0.03)).toBe('0.0')
    expect(formatSigned(25, 0)).toBe('+25')
  })

  it('converts numbers back to fields', () => {
    expect(numberToField(null)).toBe('')
    expect(numberToField(undefined)).toBe('')
    expect(numberToField(0)).toBe('0')
  })
})

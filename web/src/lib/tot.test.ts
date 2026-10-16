import { describe, expect, it } from 'vitest'

import {
  fireMoment,
  formatClock,
  formatClockTenths,
  parseClock,
  suggestImpactTime,
} from './tot'

// 15.10.2026 18:00:00 по местному времени
const NOW = new Date(2026, 9, 15, 18, 0, 0, 0).getTime()

describe('fireMoment', () => {
  it('fires earlier by the time of flight', () => {
    expect(fireMoment(NOW + 60_000, 24.5)).toBe(NOW + 35_500)
  })
})

describe('suggestImpactTime', () => {
  it('leaves time to prepare and rounds up to 10 s', () => {
    // 30 с на подготовку + 24.5 с полёта = 18:00:54.5 → 18:01:00
    expect(formatClock(suggestImpactTime(NOW, 24.5))).toBe('18:01:00')
    expect(formatClock(suggestImpactTime(NOW + 6_000, 24.5))).toBe('18:01:10')
  })
})

describe('parseClock', () => {
  it('reads hh:mm, hh:mm:ss and bare digits', () => {
    expect(formatClock(parseClock('18:30', NOW)!)).toBe('18:30:00')
    expect(formatClock(parseClock('18:30:15', NOW)!)).toBe('18:30:15')
    expect(formatClock(parseClock('183015', NOW)!)).toBe('18:30:15')
    expect(formatClock(parseClock('9:05', NOW)!)).toBe('09:05:00')
  })

  it('takes tomorrow for a time long past today', () => {
    expect(parseClock('17:00', NOW)! - NOW).toBe(23 * 3_600_000)
    // Только что прошедшее время остаётся сегодняшним
    expect(parseClock('17:58', NOW)! - NOW).toBe(-120_000)
  })

  it('rejects text that is not a time', () => {
    expect(parseClock('', NOW)).toBeNull()
    expect(parseClock('25:00', NOW)).toBeNull()
    expect(parseClock('18:61', NOW)).toBeNull()
    expect(parseClock('18.30', NOW)).toBeNull()
    expect(parseClock('12345', NOW)).toBeNull()
  })
})

describe('formatClockTenths', () => {
  it('shows tenths of a second', () => {
    expect(formatClockTenths(NOW + 41_250)).toBe('18:00:41.2')
  })
})

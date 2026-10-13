import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dayKeyOf,
  formatDayKey,
  groupByDay,
  loadEntries,
  type JournalEntry,
} from './journal'

// Запись в формате v0.6 — без азимута, погоды и боковой поправки.
const OLD_ENTRY = {
  id: 'a',
  name: 'Вышка',
  createdAt: '2026-10-13T10:00:00.000Z',
  dayKey: '2026-10-13',
  modelId: 'mk6',
  ammoId: 'default',
  charge: 1,
  distance: 1200,
  ownHeight: 10,
  targetHeight: 20,
  rangeCorrection: 0,
  elevation: 1270,
  tof: 27.1,
}

const NEW_ENTRY = {
  ...OLD_ENTRY,
  id: 'b',
  createdAt: '2026-10-14T10:00:00.000Z',
  dayKey: '2026-10-14',
  azimuth: 3840,
  azimuthUnit: 'mil',
  firingAzimuth: 3848,
  lateralCorrection: 20,
  weather: {
    windMode: 'components',
    windSpeed: null,
    windFrom: null,
    headwind: -0.3,
    crosswind: -0.4,
    temperature: 30,
    pressure: 1010,
  },
}

function stubStorage(raw: string | null) {
  vi.stubGlobal('localStorage', {
    getItem: () => raw,
    setItem: () => {},
  })
}

describe('loadEntries', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('reads old and new entries', () => {
    stubStorage(JSON.stringify([OLD_ENTRY, NEW_ENTRY]))
    expect(loadEntries().map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('drops damaged entries and keeps the rest', () => {
    stubStorage(
      JSON.stringify([
        OLD_ENTRY,
        { ...OLD_ENTRY, id: 'bad1', distance: 'far' },
        { ...OLD_ENTRY, id: 'bad2', dayKey: '13.10.2026' },
        { ...NEW_ENTRY, id: 'bad3', azimuthUnit: 'rad' },
        { ...NEW_ENTRY, id: 'bad4', weather: { windMode: 'storm' } },
        null,
      ])
    )
    expect(loadEntries().map((e) => e.id)).toEqual(['a'])
  })

  it('survives empty, broken or unavailable storage', () => {
    stubStorage(null)
    expect(loadEntries()).toEqual([])

    stubStorage('{not json')
    expect(loadEntries()).toEqual([])

    stubStorage('{"a": 1}')
    expect(loadEntries()).toEqual([])

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadEntries()).toEqual([])
  })
})

describe('days', () => {
  it('groups by day, newest first', () => {
    const entries = [
      OLD_ENTRY,
      NEW_ENTRY,
      { ...NEW_ENTRY, id: 'c', createdAt: '2026-10-14T12:00:00.000Z' },
    ] as JournalEntry[]

    const days = groupByDay(entries)
    expect(days.map((d) => d.dayKey)).toEqual(['2026-10-14', '2026-10-13'])
    expect(days[0].entries.map((e) => e.id)).toEqual(['c', 'b'])
  })

  it('formats day keys', () => {
    expect(dayKeyOf(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(formatDayKey('2026-10-14')).toBe('14.10.2026')
  })
})

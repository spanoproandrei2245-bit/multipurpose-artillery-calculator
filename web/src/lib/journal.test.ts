import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dayKeyOf,
  exportJournal,
  formatDayKey,
  groupByDay,
  loadEntries,
  matchesQuery,
  mergeEntries,
  neighbourEntry,
  recentEntries,
  parseJournalFile,
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
  mode: 'LOW',
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
        { ...NEW_ENTRY, id: 'bad5', mode: 'MID' },
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

describe('export and import', () => {
  const entries = [OLD_ENTRY, NEW_ENTRY] as JournalEntry[]

  it('round-trips through the export file', () => {
    const text = exportJournal(entries, new Date('2026-10-14T00:00:00Z'))
    const parsed = parseJournalFile(text)
    expect(parsed?.entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(parsed?.invalid).toBe(0)
  })

  it('accepts a bare array and counts damaged entries', () => {
    const parsed = parseJournalFile(
      JSON.stringify([OLD_ENTRY, { ...OLD_ENTRY, id: 'x', tof: 'slow' }])
    )
    expect(parsed?.entries.map((e) => e.id)).toEqual(['a'])
    expect(parsed?.invalid).toBe(1)
  })

  it('rejects files that are not a journal', () => {
    expect(parseJournalFile('not json')).toBeNull()
    expect(parseJournalFile('{"app":"other","entries":[]}')).toBeNull()
    expect(parseJournalFile('42')).toBeNull()
  })

  it('merges without duplicating ids', () => {
    const result = mergeEntries(
      [OLD_ENTRY] as JournalEntry[],
      [OLD_ENTRY, NEW_ENTRY, NEW_ENTRY] as JournalEntry[]
    )
    expect(result.entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(result).toMatchObject({ added: 1, skipped: 2 })
  })

  it('searches by name, model and distance', () => {
    const entry = OLD_ENTRY as JournalEntry
    expect(matchesQuery(entry, 'выш')).toBe(true)
    expect(matchesQuery(entry, 'ВЫШКА')).toBe(true)
    expect(matchesQuery(entry, 'mk6', 'Mk6 (82 mm)')).toBe(true)
    expect(matchesQuery(entry, '1200')).toBe(true)
    expect(matchesQuery(entry, 'мост')).toBe(false)
    expect(matchesQuery(entry, '  ')).toBe(true)
  })
})

describe('target cycling', () => {
  const entries = [
    { ...OLD_ENTRY, id: 'x', createdAt: '2026-10-14T08:00:00.000Z' },
    { ...OLD_ENTRY, id: 'y', createdAt: '2026-10-14T10:00:00.000Z' },
    { ...OLD_ENTRY, id: 'z', createdAt: '2026-10-14T09:00:00.000Z' },
  ] as JournalEntry[]

  it('orders recent targets newest first', () => {
    expect(recentEntries(entries).map((e) => e.id)).toEqual(['y', 'z', 'x'])
    expect(recentEntries(entries, 2).map((e) => e.id)).toEqual(['y', 'z'])
  })

  it('steps through targets and wraps around', () => {
    const list = recentEntries(entries)
    expect(neighbourEntry(list, null, 1)?.id).toBe('y')
    expect(neighbourEntry(list, 'y', 1)?.id).toBe('z')
    expect(neighbourEntry(list, 'x', 1)?.id).toBe('y')
    expect(neighbourEntry(list, 'y', -1)?.id).toBe('x')
    expect(neighbourEntry([], null, 1)).toBeUndefined()
  })
})

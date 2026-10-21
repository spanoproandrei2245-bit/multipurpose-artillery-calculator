import { setLanguage } from '../i18n'
import { describe, expect, it } from 'vitest'

import {
  formatAge,
  markerOpacity,
  parseMarker,
  planScreenMerge,
  type MapMarker,
} from './markers'

const base: MapMarker = {
  id: 'a1',
  world: 'Altis',
  x: 1000,
  y: 2000,
  label: 'ДЗОТ',
  color: 'red',
  createdAt: 1_700_000_000_000,
  author: 'Heis',
  owner: 'dev1',
  source: 'screen',
}

describe('parseMarker', () => {
  it('accepts a valid marker and trims long text', () => {
    expect(parseMarker(base)).toEqual(base)
    expect(parseMarker({ ...base, label: 'x'.repeat(100) })?.label).toHaveLength(40)
  })

  it('rejects broken markers', () => {
    expect(parseMarker(null)).toBeNull()
    expect(parseMarker({ ...base, id: '' })).toBeNull()
    expect(parseMarker({ ...base, x: Number.NaN })).toBeNull()
    expect(parseMarker({ ...base, color: 'pink' })).toBeNull()
    expect(parseMarker({ ...base, source: 'mod' })).toBeNull()
  })
})

describe('age', () => {
  it('formats minutes and hours', () => {
    expect(formatAge(20_000)).toBe('только что')
    expect(formatAge(5 * 60_000)).toBe('5 мин')
    setLanguage('en')
    expect(formatAge(65 * 60_000)).toBe('1 h 5 min')
    setLanguage('ru')
  })

  it('fades old markers but keeps them visible', () => {
    expect(markerOpacity(0)).toBe(1)
    expect(markerOpacity(60 * 60_000)).toBeCloseTo(0.35)
  })
})

describe('planScreenMerge', () => {
  const visible = { minX: 0, maxX: 5000, minY: 0, maxY: 5000 }

  it('keeps matching markers, adds new ones, removes vanished ones', () => {
    const existing: MapMarker[] = [
      base,
      { ...base, id: 'b2', x: 3000, y: 3000, color: 'blue' },
      // вне снимка — не трогаем
      { ...base, id: 'c3', x: 9000, y: 9000 },
      // поставлена руками — не трогаем
      { ...base, id: 'd4', x: 4000, y: 4000, source: 'app' },
    ]
    const plan = planScreenMerge(
      existing,
      [
        { x: 1010, y: 1990, color: 'red' },
        { x: 2500, y: 500, color: 'green' },
      ],
      visible,
      30
    )
    expect(plan.add).toEqual([{ x: 2500, y: 500, color: 'green' }])
    expect(plan.remove).toEqual(['b2'])
  })

  it('does not match a different colour in the same place', () => {
    const plan = planScreenMerge(
      [base],
      [{ x: 1000, y: 2000, color: 'blue' }],
      visible,
      30
    )
    expect(plan.add).toHaveLength(1)
    expect(plan.remove).toEqual(['a1'])
  })
})

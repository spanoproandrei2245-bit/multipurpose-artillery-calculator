import { describe, expect, it } from 'vitest'

import { aimPoints, pointAlong, polylineLength } from './fireLine'

const line = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
]

describe('fireLine', () => {
  it('считает длину ломаной', () => {
    expect(polylineLength(line)).toBe(100)
    expect(polylineLength([...line, { x: 100, y: 50 }])).toBe(150)
    expect(polylineLength([line[0]])).toBe(0)
  })

  it('находит точку на ломаной', () => {
    const bent = [...line, { x: 100, y: 50 }]
    expect(pointAlong(bent, 50)).toEqual({ x: 50, y: 0 })
    expect(pointAlong(bent, 125)).toEqual({ x: 100, y: 25 })
    expect(pointAlong(bent, 999)).toEqual({ x: 100, y: 50 })
  })

  it('одна точка для короткой линии — в середине', () => {
    const points = aimPoints(line, 60)
    expect(points).toEqual([{ x: 50, y: 0 }])
  })

  it('раскладывает точки так, что зоны перекрывают всю линию', () => {
    const radius = 15
    const long = [{ x: 0, y: 0 }, { x: 200, y: 0 }]
    const points = aimPoints(long, radius)
    // 200 / 30 → 7 разрывов
    expect(points).toHaveLength(7)
    for (let d = 0; d <= 200; d += 1) {
      const nearest = Math.min(...points.map((p) => Math.abs(p.x - d)))
      expect(nearest).toBeLessThanOrEqual(radius + 1e-9)
    }
  })

  it('без линии — пусто; линия из одной точки — один разрыв', () => {
    expect(aimPoints([], 15)).toEqual([])
    expect(aimPoints([{ x: 5, y: 5 }], 15)).toEqual([{ x: 5, y: 5 }])
  })
})

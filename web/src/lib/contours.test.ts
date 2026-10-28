import { describe, expect, it } from 'vitest'

import { contourInterval, demContours, majorEvery } from './contours'
import type { Heightmap } from './heightmap'

function makeMap(height: (x: number, y: number) => number, size = 41, step = 25): Heightmap {
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) heights[j * size + i] = height(i * step, j * step)
  }
  return { world: 'test', worldSize: (size - 1) * step, step, size, heights }
}

const wholeMap = { x0: 0, y0: 1000, scale: 1, width: 1000, height: 1000 }

describe('contourInterval', () => {
  it('чем ближе, тем гуще; мелкий масштаб — линий нет', () => {
    expect(contourInterval(0.05)).toBeNull()
    expect(contourInterval(0.3)).toBe(5)
    expect(contourInterval(1)).toBe(2)
    expect(contourInterval(3)).toBe(1)
    expect(majorEvery(1)).toBe(5)
    expect(majorEvery(5)).toBe(25)
  })
})

describe('demContours', () => {
  it('наклонная плоскость: линии высоты стоят на x = высота, вертикальные', () => {
    // Высота равна x / 5: от 0 до 200 м
    const map = makeMap((x) => x / 5)
    const levels = demContours(map, wholeMap, 10)
    // Линия нулевой высоты идёт по краю карты (там высота 0); 200 — вершина, линии нет
    expect(levels.map((l) => l.level)).toEqual(Array.from({ length: 20 }, (_, k) => k * 10))
    const l50 = levels.find((l) => l.level === 50)!
    for (let s = 0; s < l50.segments.length; s += 4) {
      const [ax, ay, bx, by] = l50.segments.slice(s, s + 4)
      // x = 250 м (высота 50 при x/5)
      expect(ax).toBeCloseTo(250, 2)
      expect(bx).toBeCloseTo(250, 2)
      expect(Math.abs(ay - by)).toBeCloseTo(25, 3)
    }
    // Линия пересекает всю карту по высоте: 1000 м из отрезков по 25 м
    expect(l50.segments.length / 4).toBe(40)
  })

  it('холм даёт замкнутые линии: длина кольца около 2πr', () => {
    const map = makeMap((x, y) => Math.max(0, 100 - Math.hypot(x - 500, y - 500) / 4))
    const level = demContours(map, wholeMap, 10).find((l) => l.level === 50)!
    // Высота 50 на расстоянии 200 м от вершины
    let length = 0
    for (let s = 0; s < level.segments.length; s += 4) {
      length += Math.hypot(level.segments[s + 2] - level.segments[s], level.segments[s + 3] - level.segments[s + 1])
    }
    expect(length).toBeGreaterThan(2 * Math.PI * 200 * 0.95)
    expect(length).toBeLessThan(2 * Math.PI * 200 * 1.05)
  })

  it('считает только видимый участок', () => {
    const map = makeMap((x) => x / 5)
    const part = demContours(map, { x0: 400, y0: 1000, scale: 1, width: 100, height: 1000 }, 10)
    const levels = part.map((l) => l.level)
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(70)
    expect(Math.max(...levels)).toBeLessThanOrEqual(110)
  })

  it('на ровном месте линий нет', () => {
    expect(demContours(makeMap(() => 33), wholeMap, 5)).toEqual([])
  })
})

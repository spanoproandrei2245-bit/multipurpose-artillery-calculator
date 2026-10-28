import { describe, expect, it } from 'vitest'

import { computeCoverage, nearestGoodSpot, overallStatus, type SolveAt } from './coverage'
import type { Heightmap } from './heightmap'

/** Карта size×size точек с шагом step; высота — функция координат. */
function makeMap(height: (x: number, y: number) => number, size = 101, step = 50): Heightmap {
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) heights[j * size + i] = height(i * step, j * step)
  }
  return { world: 'test', worldSize: (size - 1) * step, step, size, heights }
}

// Настильная стрельба по параболе: возвышение подбирается под дальность
const flat: SolveAt = (distance) => ({
  elevation: Math.min(400, (distance / 8000) * 800),
})
const never: SolveAt = () => null

describe('computeCoverage', () => {
  it('на ровной земле вокруг орудия всё чисто', () => {
    const map = makeMap(() => 100)
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 36,
    })
    expect(cov.rays).toHaveLength(36)
    expect(overallStatus(cov)).toBe('ok')
    // Один непрерывный отрезок от минимальной до максимальной дальности
    for (const ray of cov.rays) {
      expect(ray.segments).toHaveLength(1)
      expect(ray.segments[0].from).toBeGreaterThanOrEqual(100)
      expect(ray.segments[0].to).toBeLessThanOrEqual(1500)
    }
  })

  it('без решения в таблице отрезков нет', () => {
    const map = makeMap(() => 100)
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 100,
      maxRange: 1500,
      solve: never,
      rays: 12,
    })
    expect(cov.rays.every((ray) => ray.segments.length === 0)).toBe(true)
    expect(overallStatus(cov)).toBeNull()
  })

  it('гора на востоке закрывает цели за ней, на западе чисто', () => {
    // Хребет высотой 300 м на x = 3000..3200, орудие в x = 2500
    const map = makeMap((x) => (x >= 3000 && x <= 3200 ? 400 : 100))
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 4,
    })
    const east = cov.rays.find((ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9)!
    const west = cov.rays.find((ray) => Math.abs(ray.angle - (3 * Math.PI) / 2) < 1e-9)!
    expect(east.segments.some((s) => s.status === 'blocked')).toBe(true)
    expect(west.segments.every((s) => s.status === 'ok')).toBe(true)
  })

  it('режим «to»: стоять за хребтом нельзя, перед ним можно', () => {
    // Цель на западе от хребта; хребет на востоке закрывает позиции за ним
    const map = makeMap((x) => (x >= 3000 && x <= 3200 ? 400 : 100))
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'to',
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 4,
    })
    const east = cov.rays.find((ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9)!
    expect(east.segments.some((s) => s.status === 'blocked')).toBe(true)
    const north = cov.rays.find((ray) => ray.angle === 0)!
    expect(north.segments.every((s) => s.status === 'ok')).toBe(true)
  })

  it('режим «to»: в воде встать нельзя, режим «from» воду не исключает', () => {
    // Море (высота 0) к востоку от x = 3000
    const map = makeMap((x) => (x >= 3000 ? 0 : 100))
    const input = {
      map,
      center: { x: 2500, y: 2500 },
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 4,
    }
    const eastTo = computeCoverage({ ...input, mode: 'to' }).rays.find(
      (ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9
    )!
    expect(Math.max(...eastTo.segments.map((s) => s.to))).toBeLessThanOrEqual(600)
    const eastFrom = computeCoverage({ ...input, mode: 'from' }).rays.find(
      (ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9
    )!
    expect(Math.max(...eastFrom.segments.map((s) => s.to))).toBeGreaterThan(1000)
  })

  it('луч обрывается на краю карты', () => {
    const map = makeMap(() => 100, 21, 50) // 1000 м
    const cov = computeCoverage({
      map,
      center: { x: 900, y: 500 },
      mode: 'from',
      minRange: 50,
      maxRange: 2000,
      solve: flat,
      rays: 4,
    })
    const east = cov.rays.find((ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9)!
    expect(east.segments[east.segments.length - 1].to).toBeLessThanOrEqual(150)
  })

  it('пустой диапазон дальностей даёт пустой результат', () => {
    const map = makeMap(() => 100)
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 500,
      maxRange: 500,
      solve: flat,
    })
    expect(cov.rays).toEqual([])
  })
})

describe('nearestGoodSpot', () => {
  const map = makeMap(() => 100)
  const cov = computeCoverage({
    map,
    center: { x: 2500, y: 2500 },
    mode: 'to',
    minRange: 200,
    maxRange: 1200,
    solve: flat,
    rays: 36,
  })

  it('берёт зелёное место, ближайшее к орудию', () => {
    // Орудие на востоке в 1000 м от цели: ближайшее место лежит в той же стороне
    const spot = nearestGoodSpot(cov, { x: 3500, y: 2500 })
    expect(spot).not.toBeNull()
    expect(spot!.point.x).toBeGreaterThan(2500)
    expect(Math.abs(spot!.point.y - 2500)).toBeLessThan(200)
  })

  it('для режима «from» подсказки нет', () => {
    const from = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 200,
      maxRange: 1200,
      solve: flat,
      rays: 12,
    })
    expect(nearestGoodSpot(from, { x: 0, y: 0 })).toBeNull()
  })
})

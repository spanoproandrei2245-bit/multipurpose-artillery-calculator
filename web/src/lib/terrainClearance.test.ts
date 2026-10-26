import { describe, expect, it } from 'vitest'

import type { Heightmap } from './heightmap'
import { clearance, isBlocked, isTight, sampleProfile, shellHeightAt } from './terrainClearance'

// Карта 10×10 км с шагом 50 м; высота задаётся функцией от x (вдоль линии огня)
function terrain(height: (x: number) => number): Heightmap {
  const step = 50
  const size = 201
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) heights[j * size + i] = height(i * step)
  }
  return { world: 'test', worldSize: (size - 1) * step, step, size, heights }
}

const gun = { x: 1000, y: 5000 }
const target = { x: 7000, y: 5000 }

describe('профиль рельефа', () => {
  it('идёт от орудия до цели равными шагами', () => {
    const profile = sampleProfile(terrain((x) => x / 100), gun, target)!
    expect(profile.distance).toBe(6000)
    expect(profile.heights[0]).toBeCloseTo(10)
    expect(profile.heights[profile.heights.length - 1]).toBeCloseTo(70)
  })

  it('за краем карты профиля нет', () => {
    expect(sampleProfile(terrain(() => 0), gun, { x: 20000, y: 5000 })).toBeNull()
  })
})

describe('дуга снаряда', () => {
  it('начинается у орудия и приходит точно в цель', () => {
    expect(shellHeightAt(0, 6000, 100, 40, 300)).toBeCloseTo(100)
    expect(shellHeightAt(6000, 6000, 100, 40, 300)).toBeCloseTo(40)
  })

  it('на ровной земле вершина посередине: D·tg θ / 4', () => {
    const apex = shellHeightAt(3000, 6000, 0, 0, 800)
    expect(apex).toBeCloseTo((6000 * Math.tan(Math.PI / 4)) / 4)
  })
})

describe('запас над рельефом', () => {
  // Гребень высотой 150 м на полпути
  const ridge = terrain((x) => (Math.abs(x - 4000) < 150 ? 150 : 0))
  const profile = sampleProfile(ridge, gun, target)!

  it('настильная дуга упирается в гребень, навесная проходит', () => {
    // 60 мил ≈ 3.4°: на полпути снаряд примерно на 88 м
    const low = clearance(profile, 60)
    expect(isBlocked(low)).toBe(true)
    // Гребень в 3 км от орудия
    expect(low!.at).toBeGreaterThan(2800)
    expect(low!.at).toBeLessThan(3200)
    expect(isBlocked(clearance(profile, 1200))).toBe(false)
  })

  it('на ровной земле ничего не мешает, даже низко у цели', () => {
    const flat = sampleProfile(terrain(() => 20), gun, target)!
    expect(clearance(flat, 60)).toBeNull()
    expect(clearance(flat, 20)).toBeNull()
  })

  it('цель на склоне вверх: подъём перед целью не считается бугром', () => {
    const slope = sampleProfile(terrain((x) => x / 20), gun, target)!
    expect(isBlocked(clearance(slope, 120))).toBe(false)
  })

  it('задевает на пару метров — «впритык», а не «упрётся»: это в пределах точности карты', () => {
    const grazing = clearance(profile, 100)!
    expect(grazing.min).toBeLessThan(0)
    expect(isBlocked(grazing)).toBe(false)
    expect(isTight(grazing)).toBe(true)
  })

  it('низкий проход над гребнем — «впритык»', () => {
    // Подбираем угол так, чтобы над гребнем оставалось ~5 м
    const near = clearance(profile, 105)!
    expect(near.min).toBeGreaterThan(0)
    expect(isTight(near)).toBe(true)
  })
})

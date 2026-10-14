import { describe, expect, it } from 'vitest'

import { planMrsi, type MrsiOption } from './mrsi'

const option = (charge: number, tof: number, mode: 'HIGH' | 'LOW' = 'HIGH'): MrsiOption => ({
  mode,
  charge,
  elevation: 1000 + charge,
  tof,
})

describe('planMrsi', () => {
  it('fires the longest flight first and lands everything together', () => {
    const plan = planMrsi([option(3, 25.6), option(4, 35.1), option(2, 17.9)], 0)
    expect(plan.map((s) => s.charge)).toEqual([4, 3, 2])
    expect(plan.map((s) => s.fireAt)).toEqual([0, expect.closeTo(9.5), expect.closeTo(17.2)])
    for (const shot of plan) expect(shot.fireAt + shot.tof).toBeCloseTo(35.1)
  })

  it('drops shots that cannot be reloaded in time', () => {
    const plan = planMrsi([option(4, 35.1), option(3, 33), option(2, 20)], 4)
    expect(plan.map((s) => s.charge)).toEqual([4, 2])
  })

  it('mixes HIGH and LOW', () => {
    const plan = planMrsi([option(1, 14.3, 'LOW'), option(1, 42.8)], 4)
    expect(plan.map((s) => `${s.mode}${s.charge}`)).toEqual(['HIGH1', 'LOW1'])
    expect(plan[1].fireAt).toBeCloseTo(28.5)
  })

  it('handles empty input', () => {
    expect(planMrsi([], 4)).toEqual([])
  })
})

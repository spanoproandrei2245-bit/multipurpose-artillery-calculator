import { describe, expect, it } from 'vitest'

import { parseVector } from './mapVector'

describe('parseVector', () => {
  it('раскодирует дельты и считает границы', () => {
    const v = parseVector({
      version: 1,
      q: 2,
      houses: [[20, 40, 10, 0, 0, 10, -10, 0]],
      roads: { road: [[0, 0, 100, 0]] },
      names: [['namecity', 'Town', 5, 6]],
      spots: [[1, 2, 345]],
      contours: [[120, 0, 0, 20, 20]],
    })
    expect(v).not.toBeNull()
    const house = v!.houses[0]
    expect(Array.from(house.pts)).toEqual([10, 20, 15, 20, 15, 25, 10, 25])
    expect(house.minX).toBe(10)
    expect(house.maxY).toBe(25)
    expect(v!.roads.road[0].maxX).toBe(50)
    expect(v!.contours[0].elevation).toBe(120)
    expect(v!.names[0].name).toBe('Town')
    expect(v!.spots[0].elevation).toBe(345)
  })

  it('отвергает неверную версию', () => {
    expect(parseVector({ version: 2, q: 2 })).toBeNull()
    expect(parseVector(null)).toBeNull()
  })
})

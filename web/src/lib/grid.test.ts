import { describe, expect, it } from 'vitest'

import { gridVector, parseGrid } from './grid'

function vector(a: string, b: string) {
  return gridVector(parseGrid(a)!, parseGrid(b)!)
}

describe('parseGrid', () => {
  it('reads 6, 8 and 10 digit grids as square centres', () => {
    expect(parseGrid('034128')).toEqual({ x: 3450, y: 12850, precision: 100 })
    expect(parseGrid('0340 1280')).toEqual({ x: 3405, y: 12805, precision: 10 })
    expect(parseGrid('03400 12800')).toEqual({
      x: 3400.5,
      y: 12800.5,
      precision: 1,
    })
  })

  it('ignores separators', () => {
    expect(parseGrid('034-128')).toEqual(parseGrid('034128'))
  })

  it('rejects other lengths', () => {
    expect(parseGrid('')).toBeNull()
    expect(parseGrid('12345')).toBeNull()
    expect(parseGrid('1234567')).toBeNull()
  })
})

describe('gridVector', () => {
  it('measures azimuth clockwise from north in mils', () => {
    expect(vector('034128', '034130').azimuthMil).toBeCloseTo(0)
    expect(vector('034128', '036128').azimuthMil).toBeCloseTo(1600)
    expect(vector('034128', '034126').azimuthMil).toBeCloseTo(3200)
    expect(vector('034128', '032128').azimuthMil).toBeCloseTo(4800)
    expect(vector('034128', '041135').azimuthMil).toBeCloseTo(800)
  })

  it('measures distance and keeps the worst precision', () => {
    const result = vector('0340 1280', '041135')
    expect(result.precision).toBe(100)
    expect(vector('03400 12800', '03000 12800').distance).toBe(400)
  })
})

import { describe, expect, it } from 'vitest'

import {
  bearing,
  heightAt,
  isInside,
  mapExtent,
  parseHeightmap,
  toGridReference,
} from './heightmap'

// 3 × 3 точки, шаг 100 м: высота растёт на восток (x) и на север (y)
const SAMPLE = JSON.stringify({
  format: 'arma-heightmap',
  version: 1,
  world: 'Test',
  worldSize: 200,
  step: 100,
  rows: [
    [0, 10, 20],
    [100, 110, 120],
    [200, 210, 220],
  ],
})

describe('parseHeightmap', () => {
  it('reads the export from the game', () => {
    const map = parseHeightmap(SAMPLE)
    expect(map).toMatchObject({ world: 'Test', step: 100, size: 3 })
    expect(Array.from(map!.heights)).toEqual([
      0, 10, 20, 100, 110, 120, 200, 210, 220,
    ])
    expect(mapExtent(map!)).toBe(200)
  })

  it('accepts surrounding whitespace from the clipboard', () => {
    expect(parseHeightmap(`  ${SAMPLE}\n`)).not.toBeNull()
  })

  it('rejects anything else', () => {
    expect(parseHeightmap('not json')).toBeNull()
    expect(parseHeightmap('{"format":"other"}')).toBeNull()
    const ragged = JSON.parse(SAMPLE)
    ragged.rows[1] = [1, 2]
    expect(parseHeightmap(JSON.stringify(ragged))).toBeNull()
    const text = JSON.parse(SAMPLE)
    text.rows[0][0] = 'high'
    expect(parseHeightmap(JSON.stringify(text))).toBeNull()
  })
})

describe('heightAt', () => {
  const map = parseHeightmap(SAMPLE)!

  it('returns grid nodes exactly', () => {
    expect(heightAt(map, { x: 0, y: 0 })).toBe(0)
    expect(heightAt(map, { x: 200, y: 0 })).toBe(20)
    expect(heightAt(map, { x: 0, y: 200 })).toBe(200)
    expect(heightAt(map, { x: 200, y: 200 })).toBe(220)
  })

  it('interpolates between nodes', () => {
    expect(heightAt(map, { x: 50, y: 0 })).toBeCloseTo(5)
    expect(heightAt(map, { x: 0, y: 150 })).toBeCloseTo(150)
    expect(heightAt(map, { x: 150, y: 50 })).toBeCloseTo(65)
  })

  it('is null outside the map', () => {
    expect(heightAt(map, { x: -1, y: 0 })).toBeNull()
    expect(heightAt(map, { x: 0, y: 201 })).toBeNull()
    expect(isInside(map, { x: 100, y: 100 })).toBe(true)
  })
})

describe('bearing and grid', () => {
  it('measures azimuth clockwise from north', () => {
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: 100 }).azimuthMil).toBeCloseTo(0)
    expect(bearing({ x: 0, y: 0 }, { x: 100, y: 0 }).azimuthMil).toBeCloseTo(1600)
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: -100 }).azimuthMil).toBeCloseTo(3200)
    expect(bearing({ x: 0, y: 0 }, { x: -100, y: 0 }).azimuthMil).toBeCloseTo(4800)
    expect(bearing({ x: 0, y: 0 }, { x: 300, y: 400 }).distance).toBe(500)
  })

  it('formats grid references like the game', () => {
    expect(toGridReference({ x: 3412.7, y: 12856.2 })).toBe('03412 12856')
    expect(toGridReference({ x: 3412.7, y: 12856.2 }, 8)).toBe('0341 1285')
    expect(toGridReference({ x: 3412.7, y: 12856.2 }, 6)).toBe('034 128')
  })
})

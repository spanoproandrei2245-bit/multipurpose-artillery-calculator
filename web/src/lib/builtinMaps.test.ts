import { describe, expect, it } from 'vitest'

import {
  decodeHeights,
  metersPerTile,
  parseMapDescription,
  tileLevel,
  visibleTiles,
  type MapTiles,
} from './builtinMaps'

const DESCRIPTION = {
  format: 'arma-map',
  version: 1,
  world: 'stratis',
  displayName: 'Стратис',
  author: 'Bohemia Interactive',
  worldSize: 8192,
  background: '#4b555f',
  heights: { file: 'heights.bin', step: 20, size: 3, scale: 0.1 },
  tiles: { size: 512, levels: 4, metersPerTile: 1024, ext: 'webp' },
}

const TILES: MapTiles = {
  base: './maps/stratis/tiles/',
  size: 512,
  levels: 4,
  metersPerTile: 1024,
  ext: 'webp',
  background: '#4b555f',
  worldSize: 8192,
}

describe('parseMapDescription', () => {
  it('accepts the importer output', () => {
    expect(parseMapDescription(DESCRIPTION)?.displayName).toBe('Стратис')
  })

  it('rejects other formats and unsafe paths', () => {
    expect(parseMapDescription(null)).toBeNull()
    expect(parseMapDescription({ ...DESCRIPTION, format: 'other' })).toBeNull()
    expect(parseMapDescription({ ...DESCRIPTION, world: '../etc' })).toBeNull()
    expect(
      parseMapDescription({
        ...DESCRIPTION,
        heights: { ...DESCRIPTION.heights, file: '../x.bin' },
      })
    ).toBeNull()
    expect(
      parseMapDescription({ ...DESCRIPTION, tiles: { ...DESCRIPTION.tiles, levels: 0 } })
    ).toBeNull()
  })
})

describe('decodeHeights', () => {
  it('turns decimetres into metres and checks the size', () => {
    const description = parseMapDescription(DESCRIPTION)!
    const raw = Int16Array.from([0, 105, -20, 1000, 1234, 0, 0, 0, 32767])
    const map = decodeHeights(raw.buffer, description)!
    expect(map.size).toBe(3)
    expect(map.heights[1]).toBeCloseTo(10.5)
    expect(map.heights[2]).toBeCloseTo(-2)
    expect(decodeHeights(new ArrayBuffer(4), description)).toBeNull()
  })
})

describe('tile pyramid', () => {
  it('doubles the tile size at each coarser level', () => {
    expect(metersPerTile(TILES, 3)).toBe(1024)
    expect(metersPerTile(TILES, 0)).toBe(8192)
  })

  it('picks the coarsest level that is sharp enough', () => {
    // Вся карта на 500 px — хватает одного тайла 512 px
    expect(tileLevel(TILES, 500 / 8192)).toBe(0)
    // На 576 px тайла 512 px уже мало — уровень 1
    expect(tileLevel(TILES, 576 / 8192)).toBe(1)
    // Уровни дают 0.0625 / 0.125 / 0.25 / 0.5 px/м
    expect(tileLevel(TILES, 0.2)).toBe(2)
    expect(tileLevel(TILES, 0.4)).toBe(3)
    // Ближе самого подробного — остаётся последний уровень
    expect(tileLevel(TILES, 3)).toBe(3)
  })

  it('lists only tiles in view, north row first', () => {
    const tiles = visibleTiles(TILES, 3, {
      minX: 1500,
      maxX: 2500,
      minY: 7000,
      maxY: 8192,
    })
    expect(tiles.map((t) => t.url.split('/').pop())).toEqual([
      '1_0.webp',
      '1_1.webp',
      '2_0.webp',
      '2_1.webp',
    ])
    expect(tiles[0]).toMatchObject({ x: 1024, y: 8192, meters: 1024 })
  })

  it('clamps the view to the map', () => {
    const tiles = visibleTiles(TILES, 0, {
      minX: -5000,
      maxX: 20000,
      minY: -5000,
      maxY: 20000,
    })
    expect(tiles).toHaveLength(1)
  })
})

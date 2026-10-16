import { describe, expect, it } from 'vitest'

import { heightColor, renderRelief } from './relief'
import type { Heightmap } from './heightmap'

const brightness = ([r, g, b]: readonly number[]) => (r + g + b) / 3

describe('heightColor', () => {
  it('keeps the night palette dark and the sea below the land', () => {
    for (const height of [-50, 0, 100, 400, 1000]) {
      expect(brightness(heightColor(height, 'night'))).toBeLessThan(
        brightness(heightColor(height, 'day'))
      )
      expect(brightness(heightColor(height, 'night'))).toBeLessThan(100)
    }
    expect(brightness(heightColor(-20, 'night'))).toBeLessThan(
      brightness(heightColor(20, 'night'))
    )
  })

  it('gets lighter with height on land', () => {
    for (const palette of ['day', 'night'] as const) {
      expect(brightness(heightColor(600, palette))).toBeGreaterThan(
        brightness(heightColor(50, palette))
      )
    }
  })
})

describe('renderRelief', () => {
  it('draws one opaque pixel per grid node, north up', () => {
    // 2×2: юг — море, север — суша
    const map: Heightmap = {
      world: 'Test',
      worldSize: 200,
      step: 100,
      size: 2,
      heights: Float32Array.from([-30, -30, 80, 80]),
    }
    const pixels = renderRelief(map, 'night')
    expect(pixels).toHaveLength(2 * 2 * 4)
    // Строка 0 изображения — север (суша), строка 1 — юг (море)
    const north = brightness([...pixels.slice(0, 3)])
    const south = brightness([...pixels.slice(8, 11)])
    expect(north).toBeGreaterThan(south)
    expect(pixels[3]).toBe(255)
  })
})

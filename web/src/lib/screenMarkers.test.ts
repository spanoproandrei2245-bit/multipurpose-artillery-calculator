import { describe, expect, it } from 'vitest'

import {
  calibrate,
  classifyPixel,
  findBlobs,
  pixelToMap,
  visibleArea,
} from './screenMarkers'

// Бледная «бумажная» карта
const PAPER = [222, 218, 200]

function image(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    data.set([...PAPER, 255], i * 4)
  }
  const fill = (x0: number, y0: number, w: number, h: number, rgb: number[]) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) data.set([...rgb, 255], (y * width + x) * 4)
    }
  }
  return { data, fill }
}

describe('classifyPixel', () => {
  it('recognises Arma marker colours', () => {
    expect(classifyPixel(230, 0, 0)).toBe('red')
    expect(classifyPixel(0, 0, 255)).toBe('blue')
    expect(classifyPixel(0, 204, 0)).toBe('green')
    expect(classifyPixel(217, 102, 0)).toBe('orange')
    expect(classifyPixel(217, 217, 0)).toBe('yellow')
    expect(classifyPixel(176, 0, 176)).toBe('purple')
  })

  it('ignores the pale map and dark lines', () => {
    expect(classifyPixel(222, 218, 200)).toBeNull()
    expect(classifyPixel(150, 190, 140)).toBeNull() // лес
    expect(classifyPixel(170, 200, 230)).toBeNull() // вода
    expect(classifyPixel(20, 20, 20)).toBeNull() // сетка, подписи
  })
})

describe('findBlobs', () => {
  it('finds icon-sized markers and their centres', () => {
    const { data, fill } = image(200, 120)
    fill(40, 30, 16, 16, [230, 0, 0])
    fill(120, 80, 12, 12, [0, 0, 255])
    const blobs = findBlobs(data, 200, 120)
    expect(blobs).toHaveLength(2)
    const red = blobs.find((b) => b.color === 'red')!
    expect(red.x).toBeCloseTo(47.5)
    expect(red.y).toBeCloseTo(37.5)
    expect(blobs.find((b) => b.color === 'blue')).toBeDefined()
  })

  it('skips long roads, specks and label letters', () => {
    const { data, fill } = image(300, 120)
    fill(0, 100, 300, 4, [217, 102, 0]) // дорога
    fill(10, 10, 2, 2, [230, 0, 0]) // соринка
    fill(40, 30, 16, 16, [230, 0, 0]) // значок
    fill(62, 32, 7, 10, [230, 0, 0]) // буквы подписи
    fill(72, 32, 7, 10, [230, 0, 0])
    const blobs = findBlobs(data, 300, 120)
    expect(blobs).toHaveLength(1)
    expect(blobs[0].color).toBe('red')
  })
})

describe('calibration', () => {
  it('maps pixels to metres with north up', () => {
    // 1 пиксель = 2 м; пиксель (100, 100) — точка 5000 / 3000
    const c = calibrate(
      { px: 100, py: 100, x: 5000, y: 3000 },
      { px: 300, py: 300, x: 5400, y: 2600 }
    )!
    expect(c.scale).toBeCloseTo(2)
    expect(pixelToMap(c, 200, 50)).toEqual({ x: 5200, y: 3100 })
    const area = visibleArea(c, 400, 200)
    expect(area.minX).toBeCloseTo(4800)
    expect(area.maxY).toBeCloseTo(3200)
    expect(area.minY).toBeCloseTo(2800)
  })

  it('rejects points that are too close or identical', () => {
    expect(
      calibrate({ px: 0, py: 0, x: 0, y: 0 }, { px: 5, py: 5, x: 100, y: 100 })
    ).toBeNull()
    expect(
      calibrate({ px: 0, py: 0, x: 0, y: 0 }, { px: 100, py: 0, x: 0, y: 0 })
    ).toBeNull()
  })
})

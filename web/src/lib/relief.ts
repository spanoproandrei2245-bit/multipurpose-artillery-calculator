import type { Heightmap } from './heightmap'

type Rgb = readonly [number, number, number]

/** day — цветная карта (светлая тема), night — тёмный монохром. */
export type ReliefPalette = 'day' | 'night'

interface Palette {
  seaDeep: Rgb
  seaShallow: Rgb
  land: readonly (readonly [number, Rgb])[]
}

// day: море — синие, суша — от зелёного к светло-бурому.
// night: тёплые серые оттенки, море темнее суши — как ночной прицел.
const PALETTES: Record<ReliefPalette, Palette> = {
  day: {
    seaDeep: [28, 58, 102],
    seaShallow: [72, 128, 176],
    land: [
      [0, [118, 150, 92]],
      [150, [150, 160, 98]],
      [400, [176, 160, 112]],
      [800, [196, 186, 162]],
    ],
  },
  night: {
    seaDeep: [10, 13, 16],
    seaShallow: [20, 26, 31],
    land: [
      [0, [44, 43, 40]],
      [150, [56, 54, 50]],
      [400, [70, 67, 61]],
      [800, [88, 84, 77]],
    ],
  },
}

// Свет с северо-запада, сверху (x — восток, y — север, z — вверх)
const LIGHT = (() => {
  const v = [-1, 1, 1.4]
  const length = Math.hypot(v[0], v[1], v[2])
  return v.map((c) => c / length) as [number, number, number]
})()

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

export function heightColor(
  height: number,
  palette: ReliefPalette = 'day'
): Rgb {
  const { seaDeep, seaShallow, land } = PALETTES[palette]
  if (height <= 0) {
    return mix(seaShallow, seaDeep, Math.min(1, -height / 60))
  }
  for (let k = 1; k < land.length; k += 1) {
    const [h1, c1] = land[k]
    const [h0, c0] = land[k - 1]
    if (height <= h1) return mix(c0, c1, (height - h0) / (h1 - h0))
  }
  return land[land.length - 1][1]
}

/**
 * Цветной рельеф с отмывкой: RGBA, по пикселю на узел сетки.
 * Строка 0 изображения — север (как на карте).
 */
export function renderRelief(
  map: Heightmap,
  palette: ReliefPalette = 'day'
): Uint8ClampedArray<ArrayBuffer> {
  const { size, step, heights } = map
  const pixels = new Uint8ClampedArray(size * size * 4)
  const at = (i: number, j: number) =>
    heights[
      Math.min(size - 1, Math.max(0, j)) * size +
        Math.min(size - 1, Math.max(0, i))
    ]

  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const h = at(i, j)
      const color = heightColor(h, palette)

      let brightness = 1
      if (h > 0) {
        // Нормаль по разностям соседних узлов
        const dzdx = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
        const dzdy = (at(i, j + 1) - at(i, j - 1)) / (2 * step)
        const length = Math.hypot(dzdx, dzdy, 1)
        const dot =
          (-dzdx * LIGHT[0] + -dzdy * LIGHT[1] + LIGHT[2]) / length
        // 1 — ровная местность; склоны к свету светлее, от света темнее
        brightness = Math.min(1.25, Math.max(0.35, 0.3 + (0.7 * dot) / LIGHT[2]))
      }

      const row = size - 1 - j
      const p = (row * size + i) * 4
      pixels[p] = color[0] * brightness
      pixels[p + 1] = color[1] * brightness
      pixels[p + 2] = color[2] * brightness
      pixels[p + 3] = 255
    }
  }

  return pixels
}

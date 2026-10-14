import type { MarkerColor } from './markers'

/**
 * Поиск меток на скриншоте карты Arma.
 *
 * Бумажная карта игры бледная: лес, поля и вода — низкая
 * насыщенность. Метки игроков нарисованы чистыми цветами
 * (ColorRed, ColorBlue…), поэтому ищем насыщенные пятна размером
 * со значок. Длинные дороги отсекаются по размеру, буквы подписей
 * справа от значка — по соседству с более крупным пятном того же цвета.
 */

export interface Blob {
  // Центр пятна, пиксели скриншота
  x: number
  y: number
  color: MarkerColor
  area: number
  width: number
  height: number
}

export interface DetectOptions {
  minSize: number
  maxSize: number
  minArea: number
  // Доля закрашенных пикселей в рамке пятна
  minFill: number
}

export const DEFAULT_DETECT: DetectOptions = {
  minSize: 7,
  maxSize: 48,
  minArea: 20,
  minFill: 0.2,
}

/** Цвет метки по пикселю; null — фон карты. */
export function classifyPixel(r: number, g: number, b: number): MarkerColor | null {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const value = max / 255
  const saturation = max === 0 ? 0 : (max - min) / max

  // Чёрные метки не ищем: чёрным на карте нарисованы сетка,
  // подписи и горизонтали — их не отличить от значков.
  if (saturation < 0.6 || value < 0.35) return null

  let hue: number
  const delta = max - min
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue = (hue * 60 + 360) % 360

  if (hue < 18 || hue >= 330) return 'red'
  if (hue < 42) return 'orange'
  if (hue < 70) return 'yellow'
  if (hue < 170) return 'green'
  if (hue >= 200 && hue < 260) return 'blue'
  if (hue >= 270 && hue < 330) return 'purple'
  return null
}

/** Насыщенные пятна размером со значок метки. */
export function findBlobs(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: DetectOptions = DEFAULT_DETECT
): Blob[] {
  const colors = new Int8Array(width * height).fill(-1)
  const palette: MarkerColor[] = []
  for (let i = 0; i < width * height; i += 1) {
    const color = classifyPixel(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
    if (!color) continue
    let index = palette.indexOf(color)
    if (index < 0) index = palette.push(color) - 1
    colors[i] = index
  }

  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const blobs: Blob[] = []

  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || colors[start] < 0) continue
    const color = colors[start]
    let area = 0
    let sumX = 0
    let sumY = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    let tooBig = false

    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const index = stack.pop()!
      const x = index % width
      const y = (index - x) / width
      area += 1
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (maxX - minX > options.maxSize * 2 || maxY - minY > options.maxSize * 2) {
        tooBig = true
      }

      // 8 соседей: тонкие диагональные линии значков не рвутся
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const next = ny * width + nx
          if (!seen[next] && colors[next] === color) {
            seen[next] = 1
            stack.push(next)
          }
        }
      }
    }

    const w = maxX - minX + 1
    const h = maxY - minY + 1
    if (
      tooBig ||
      w > options.maxSize ||
      h > options.maxSize ||
      Math.max(w, h) < options.minSize ||
      area < options.minArea ||
      area / (w * h) < options.minFill
    ) {
      continue
    }

    blobs.push({
      x: sumX / area,
      y: sumY / area,
      color: palette[color],
      area,
      width: w,
      height: h,
    })
  }

  return dropLabels(mergeNearby(blobs))
}

/** Части одного значка (крест, рамка) — в одно пятно. */
function mergeNearby(blobs: Blob[]): Blob[] {
  const result: Blob[] = []
  for (const blob of [...blobs].sort((a, b) => b.area - a.area)) {
    const host = result.find(
      (other) =>
        other.color === blob.color &&
        Math.hypot(other.x - blob.x, other.y - blob.y) <
          Math.max(other.width, other.height) * 0.6
    )
    if (host) {
      const area = host.area + blob.area
      host.x = (host.x * host.area + blob.x * blob.area) / area
      host.y = (host.y * host.area + blob.y * blob.area) / area
      host.area = area
    } else {
      result.push({ ...blob })
    }
  }
  return result
}

/** Буквы подписи справа от значка того же цвета — не метки. */
function dropLabels(blobs: Blob[]): Blob[] {
  const sorted = [...blobs].sort((a, b) => b.area - a.area)
  const kept: Blob[] = []
  for (const blob of sorted) {
    const isLabel = kept.some(
      (icon) =>
        icon.color === blob.color &&
        blob.x > icon.x &&
        blob.x - icon.x < 260 &&
        Math.abs(blob.y - icon.y) < icon.height * 0.75 &&
        blob.area < icon.area
    )
    if (!isLabel) kept.push(blob)
  }
  return kept
}

// ---- калибровка: пиксели скриншота → метры карты ----

export interface CalibrationPoint {
  // Пиксель на скриншоте
  px: number
  py: number
  // Метры карты (из координаты сетки)
  x: number
  y: number
}

export interface Calibration {
  // Метров на пиксель
  scale: number
  // Пиксель (0, 0) в метрах
  originX: number
  originY: number
}

/**
 * Две точки с известными координатами. Карта Arma не повёрнута:
 * север вверху, масштаб по осям одинаковый.
 */
export function calibrate(
  a: CalibrationPoint,
  b: CalibrationPoint
): Calibration | null {
  const pixels = Math.hypot(b.px - a.px, b.py - a.py)
  const metres = Math.hypot(b.x - a.x, b.y - a.y)
  if (pixels < 20 || metres <= 0) return null
  const scale = metres / pixels
  return {
    scale,
    originX: a.x - a.px * scale,
    originY: a.y + a.py * scale,
  }
}

export function pixelToMap(c: Calibration, px: number, py: number) {
  return { x: c.originX + px * c.scale, y: c.originY - py * c.scale }
}

/** Видимая на скриншоте область карты, м. */
export function visibleArea(c: Calibration, width: number, height: number) {
  return {
    minX: c.originX,
    maxX: c.originX + width * c.scale,
    minY: c.originY - height * c.scale,
    maxY: c.originY,
  }
}

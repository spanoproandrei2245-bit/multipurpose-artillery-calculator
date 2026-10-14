import { MILS_PER_TURN } from './ballistics'

/**
 * Сетка высот карты, выгруженная из игры скриптом
 * src/data/export-heightmap.sqf.
 *
 * Координаты как в игре: x — на восток, y — на север, от юго-западного
 * угла карты, в метрах. Точка (i, j) сетки — это x = i·step, y = j·step;
 * heights[j * size + i] — высота над уровнем моря (ASL), м.
 */
export interface Heightmap {
  world: string
  worldSize: number
  step: number
  // Точек по каждой стороне
  size: number
  heights: Float32Array
}

export interface MapPoint {
  x: number
  y: number
}

const FORMAT = 'arma-heightmap'

/** Разбор файла из игры; null — это не сетка высот. */
export function parseHeightmap(text: string): Heightmap | null {
  let data: unknown
  try {
    data = JSON.parse(text.trim())
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null

  const v = data as Record<string, unknown>
  if (
    v.format !== FORMAT ||
    v.version !== 1 ||
    typeof v.world !== 'string' ||
    v.world === '' ||
    typeof v.worldSize !== 'number' ||
    !(v.worldSize > 0) ||
    typeof v.step !== 'number' ||
    !(v.step > 0) ||
    !Array.isArray(v.rows)
  ) {
    return null
  }

  const rows = v.rows as unknown[]
  const size = rows.length
  if (size < 2) return null

  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j += 1) {
    const row = rows[j]
    if (!Array.isArray(row) || row.length !== size) return null
    for (let i = 0; i < size; i += 1) {
      const h = row[i]
      if (typeof h !== 'number' || !Number.isFinite(h)) return null
      heights[j * size + i] = h
    }
  }

  return {
    world: v.world,
    worldSize: v.worldSize,
    step: v.step,
    size,
    heights,
  }
}

/** Протяжённость сетки, м (может быть чуть меньше worldSize). */
export function mapExtent(map: Heightmap): number {
  return (map.size - 1) * map.step
}

export function isInside(map: Heightmap, point: MapPoint): boolean {
  const extent = mapExtent(map)
  return (
    point.x >= 0 && point.y >= 0 && point.x <= extent && point.y <= extent
  )
}

/** Высота в точке: билинейная интерполяция между узлами сетки. */
export function heightAt(map: Heightmap, point: MapPoint): number | null {
  if (!isInside(map, point)) return null

  const fx = point.x / map.step
  const fy = point.y / map.step
  const i = Math.min(Math.floor(fx), map.size - 2)
  const j = Math.min(Math.floor(fy), map.size - 2)
  const tx = fx - i
  const ty = fy - j

  const at = (di: number, dj: number) =>
    map.heights[(j + dj) * map.size + (i + di)]

  const south = at(0, 0) * (1 - tx) + at(1, 0) * tx
  const north = at(0, 1) * (1 - tx) + at(1, 1) * tx
  return south * (1 - ty) + north * ty
}

/** Дистанция (м) и азимут (мил, 0 — север, по часовой) от a к b. */
export function bearing(a: MapPoint, b: MapPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const angle = Math.atan2(dx, dy)
  return {
    distance: Math.hypot(dx, dy),
    azimuthMil:
      (((angle * MILS_PER_TURN) / (2 * Math.PI)) % MILS_PER_TURN +
        MILS_PER_TURN) %
      MILS_PER_TURN,
  }
}

/** Координата сетки игры: 10 цифр (до метра), «03412 12856». */
export function toGridReference(point: MapPoint, digits: 6 | 8 | 10 = 10) {
  const half = digits / 2
  const unit = 10 ** (5 - half)
  const part = (value: number) =>
    String(Math.max(0, Math.floor(value / unit))).padStart(half, '0')
  return `${part(point.x)} ${part(point.y)}`
}

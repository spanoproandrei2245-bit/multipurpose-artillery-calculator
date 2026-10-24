import { isDesktop } from './desktop'
import type { Heightmap } from './heightmap'
import { PUBLIC_SITE_URL } from './sync'

/**
 * Встроенные карты: спутниковый снимок тайлами и высоты, собранные
 * скриптом scripts/import-grad-meh.mjs из выгрузки мода grad_meh.
 * Лежат в public/maps/ и открываются без импорта — на сайте, телефоне
 * и в программе для ПК (она берёт их с сайта, чтобы не раздувать
 * установщик).
 */

export const MAPS_BASE = isDesktop ? `${PUBLIC_SITE_URL}maps/` : './maps/'

export interface BuiltinMapEntry {
  world: string
  displayName: string
  // Названия на других языках (ключ — код языка), если отличаются от displayName
  names?: Partial<Record<string, string>>
  author: string
  // official — Bohemia Interactive, community — карты сообщества
  kind?: 'official' | 'community'
  worldSize: number
}

/** Происхождение карты; у старых записей index.json kind нет — смотрим на автора. */
export function mapKind(entry: Pick<BuiltinMapEntry, 'kind' | 'author'>): 'official' | 'community' {
  if (entry.kind) return entry.kind
  return /bohemia/i.test(entry.author) ? 'official' : 'community'
}

export interface MapTiles {
  // Адрес папки тайлов, с «/» на конце
  base: string
  size: number
  // Уровней пирамиды; 0 — вся карта одним тайлом
  levels: number
  // Метров на тайл верхнего (самого подробного) уровня
  metersPerTile: number
  ext: string
  background: string
  worldSize: number
}

export interface MapDescription {
  world: string
  displayName: string
  author: string
  worldSize: number
  background: string
  heights: { file: string; step: number; size: number; scale: number }
  // vector.json: здания, дороги, горизонтали (есть не у всех карт)
  vector?: string
  // Нет у карт без спутникового снимка (только топо)
  tiles: { size: number; levels: number; metersPerTile: number; ext: string } | null
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isString = (value: unknown): value is string => typeof value === 'string'

/** Проверка map.json; null — не наш формат или повреждён. */
export function parseMapDescription(value: unknown): MapDescription | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const h = v.heights as Record<string, unknown> | undefined
  const t = v.tiles as Record<string, unknown> | undefined
  if (
    v.format !== 'arma-map' ||
    v.version !== 1 ||
    !isString(v.world) ||
    !/^[a-z0-9_-]+$/.test(v.world) ||
    !isNumber(v.worldSize) ||
    typeof h !== 'object' ||
    h === null ||
    !isString(h.file) ||
    !/^[\w.-]+$/.test(h.file) ||
    !isNumber(h.step) ||
    !isNumber(h.size) ||
    !isNumber(h.scale) ||
    (v.topoOnly !== true &&
      (typeof t !== 'object' ||
        t === null ||
        !isNumber(t.size) ||
        !isNumber(t.levels) ||
        !isNumber(t.metersPerTile) ||
        !isString(t.ext) ||
        !/^\w+$/.test(t.ext)))
  ) {
    return null
  }
  return {
    world: v.world,
    displayName: isString(v.displayName) ? v.displayName : v.world,
    author: isString(v.author) ? v.author : '',
    worldSize: v.worldSize,
    background: isString(v.background) ? v.background : '#4b555f',
    vector: isString(v.vector) && /^[\w.-]+$/.test(v.vector) ? v.vector : undefined,
    heights: {
      file: h.file,
      step: h.step,
      size: Math.round(h.size),
      scale: h.scale,
    },
    tiles:
      v.topoOnly === true || !t
        ? null
        : {
            size: Math.round(t.size as number),
            levels: Math.round(t.levels as number),
            metersPerTile: t.metersPerTile as number,
            ext: t.ext as string,
          },
  }
}

/** Высоты из heights.bin: Int16, строки с юга на север. */
export function decodeHeights(
  buffer: ArrayBuffer,
  description: MapDescription
): Heightmap | null {
  const { size, step, scale } = description.heights
  if (buffer.byteLength !== size * size * 2) return null
  const raw = new Int16Array(buffer)
  const heights = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) heights[i] = raw[i] * scale
  return {
    world: description.world,
    worldSize: description.worldSize,
    step,
    size,
    heights,
  }
}

export async function listBuiltinMaps(): Promise<BuiltinMapEntry[]> {
  try {
    const response = await fetch(`${MAPS_BASE}index.json`)
    if (!response.ok) return []
    const data = (await response.json()) as { maps?: unknown }
    if (!Array.isArray(data.maps)) return []
    return data.maps.filter(
      (m): m is BuiltinMapEntry =>
        typeof m === 'object' &&
        m !== null &&
        isString((m as BuiltinMapEntry).world) &&
        isString((m as BuiltinMapEntry).displayName) &&
        isNumber((m as BuiltinMapEntry).worldSize)
    )
  } catch {
    // Нет сети и нет кэша — встроенных карт нет
    return []
  }
}

export async function loadBuiltinMap(
  world: string
): Promise<{
  heightmap: Heightmap
  tiles: MapTiles | null
  displayName: string
  vectorUrl: string | null
} | null> {
  const base = `${MAPS_BASE}${world}/`
  const description = parseMapDescription(
    await (await fetch(`${base}map.json`)).json()
  )
  if (!description) return null
  const buffer = await (await fetch(`${base}${description.heights.file}`)).arrayBuffer()
  const heightmap = decodeHeights(buffer, description)
  if (!heightmap) return null
  return {
    heightmap,
    displayName: description.displayName,
    vectorUrl: description.vector ? `${base}${description.vector}` : null,
    tiles: description.tiles
      ? {
          ...description.tiles,
          base: `${base}tiles/`,
          background: description.background,
          worldSize: description.worldSize,
        }
      : null,
  }
}

/** Метров на тайл уровня z. */
export function metersPerTile(tiles: MapTiles, z: number): number {
  return tiles.metersPerTile * 2 ** (tiles.levels - 1 - z)
}

/**
 * Уровень пирамиды для масштаба: самый грубый, у которого пикселей
 * тайла на метр не меньше, чем пикселей экрана на метр.
 */
export function tileLevel(tiles: MapTiles, screenPixelsPerMeter: number): number {
  for (let z = 0; z < tiles.levels; z += 1) {
    if (tiles.size / metersPerTile(tiles, z) >= screenPixelsPerMeter) return z
  }
  return tiles.levels - 1
}

export interface VisibleTile {
  url: string
  // Левый верхний угол тайла в метрах карты (y — север)
  x: number
  y: number
  meters: number
}

/** Тайлы уровня z, попадающие в область [minX, maxX] × [minY, maxY], м. */
export function visibleTiles(
  tiles: MapTiles,
  z: number,
  area: { minX: number; maxX: number; minY: number; maxY: number }
): VisibleTile[] {
  const meters = metersPerTile(tiles, z)
  const cols = Math.ceil(tiles.worldSize / meters)
  const top = tiles.worldSize
  const x0 = Math.max(0, Math.floor(area.minX / meters))
  const x1 = Math.min(cols - 1, Math.floor(area.maxX / meters))
  // Строка 0 — север: y тайла отсчитывается от верхнего края карты
  const y0 = Math.max(0, Math.floor((top - area.maxY) / meters))
  const y1 = Math.min(cols - 1, Math.floor((top - area.minY) / meters))
  const result: VisibleTile[] = []
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      result.push({
        url: `${tiles.base}${z}/${x}_${y}.${tiles.ext}`,
        x: x * meters,
        y: top - y * meters,
        meters,
      })
    }
  }
  return result
}

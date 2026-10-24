/**
 * Векторный слой карты (vector.json, см. scripts/build-vector.mjs): здания,
 * дороги, леса, горизонтали, названия и отметки высот. Рисуется на холсте
 * поверх спутника при большом приближении или вместо него («топо»-режим).
 */

export type MapStyle = 'sat' | 'topo'

interface Shape {
  pts: Float32Array // x0,y0,x1,y1,… в метрах мира
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface Contour extends Shape {
  elevation: number
}

export interface MapVector {
  houses: Shape[]
  forests: Shape[]
  runways: Shape[]
  roads: Record<RoadKind, Shape[]>
  names: { type: string; name: string; x: number; y: number }[]
  spots: { x: number; y: number; elevation: number }[]
  contours: Contour[]
}

export type RoadKind = 'main_road' | 'road' | 'track' | 'trail'
const ROAD_KINDS: RoadKind[] = ['trail', 'track', 'road', 'main_road']

function decode(path: number[], q: number, from = 0): Shape | null {
  const n = Math.floor((path.length - from) / 2)
  if (n < 2) return null
  const pts = new Float32Array(n * 2)
  let x = 0
  let y = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i += 1) {
    x += path[from + i * 2]
    y += path[from + i * 2 + 1]
    const mx = x / q
    const my = y / q
    pts[i * 2] = mx
    pts[i * 2 + 1] = my
    if (mx < minX) minX = mx
    if (mx > maxX) maxX = mx
    if (my < minY) minY = my
    if (my > maxY) maxY = my
  }
  return { pts, minX, maxX, minY, maxY }
}

const shapes = (list: unknown, q: number, from = 0): Shape[] =>
  (Array.isArray(list) ? list : [])
    .map((p) => (Array.isArray(p) ? decode(p as number[], q, from) : null))
    .filter((s): s is Shape => s !== null)

/** Разбор vector.json; null — неверный формат. */
export function parseVector(value: unknown): MapVector | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (v.version !== 1 || typeof v.q !== 'number' || v.q <= 0) return null
  const q = v.q
  const roadsRaw = (typeof v.roads === 'object' && v.roads !== null ? v.roads : {}) as Record<string, unknown>
  const contours: Contour[] = []
  if (Array.isArray(v.contours)) {
    for (const c of v.contours as number[][]) {
      const shape = decode(c, q, 1)
      if (shape) contours.push({ ...shape, elevation: c[0] })
    }
  }
  return {
    houses: shapes(v.houses, q),
    forests: shapes(v.forests, q),
    runways: shapes(v.runways, q),
    roads: {
      main_road: shapes(roadsRaw.main_road, q),
      road: shapes(roadsRaw.road, q),
      track: shapes(roadsRaw.track, q),
      trail: shapes(roadsRaw.trail, q),
    },
    names: (Array.isArray(v.names) ? v.names : [])
      .filter((n): n is [string, string, number, number] => Array.isArray(n) && typeof n[1] === 'string')
      .map(([type, name, x, y]) => ({ type, name, x, y })),
    spots: (Array.isArray(v.spots) ? v.spots : [])
      .filter((s): s is [number, number, number] => Array.isArray(s) && s.length === 3)
      .map(([x, y, elevation]) => ({ x, y, elevation })),
    contours,
  }
}

export async function loadVector(url: string): Promise<MapVector | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return parseVector(await response.json())
  } catch {
    return null
  }
}

export interface VectorView {
  x0: number
  y0: number
  scale: number // пикселей на метр
  width: number
  height: number
}

/** С какого приближения вообще рисуется векторный слой поверх спутника. */
export const SAT_OVERLAY_MIN_SCALE = 0.45

const NAME_MIN_SCALE: Record<string, number> = {
  namecitycapital: 0,
  namecity: 0,
  namevillage: 0.03,
  namelocal: 0.12,
  hill: 0.08,
}

const TOPO = {
  paper: '#f4f2ea',
  forest: '#dfe7cf',
  runway: '#d9d9d4',
  houseFill: '#8c8c88',
  houseStroke: '#4d4d4a',
  contour: '#d1b48c',
  contourMajor: '#b58f5c',
  text: '#1f1f1f',
  roads: {
    main_road: { casing: '#7a5a1c', fill: '#f2c55c', width: 9 },
    road: { casing: '#555555', fill: '#ffffff', width: 6 },
    track: { casing: '#8a6a3a', fill: '#8a6a3a', width: 3 },
    trail: { casing: '#8a6a3a', fill: '#8a6a3a', width: 1.5 },
  },
}

/** Цвет фона в топо-режиме (рисуется вместо рельефа и спутника). */
export const TOPO_PAPER = TOPO.paper

/** Фигура в кадре и не мельче minPx пикселей (мелочь не рисуется). */
function visible(s: Shape, v: VectorView, minPx = 0): boolean {
  if (minPx > 0 && Math.max(s.maxX - s.minX, s.maxY - s.minY) * v.scale < minPx) return false
  const maxX = v.x0 + v.width / v.scale
  const minY = v.y0 - v.height / v.scale
  return s.maxX >= v.x0 && s.minX <= maxX && s.maxY >= minY && s.minY <= v.y0
}

function trace(ctx: CanvasRenderingContext2D, s: Shape, v: VectorView, close: boolean) {
  const { pts } = s
  ctx.moveTo((pts[0] - v.x0) * v.scale, (v.y0 - pts[1]) * v.scale)
  for (let i = 2; i < pts.length; i += 2) {
    ctx.lineTo((pts[i] - v.x0) * v.scale, (v.y0 - pts[i + 1]) * v.scale)
  }
  if (close) ctx.closePath()
}

export function drawVector(
  ctx: CanvasRenderingContext2D,
  vec: MapVector,
  v: VectorView,
  style: MapStyle,
  font: string
) {
  const topo = style === 'topo'
  if (!topo && v.scale < SAT_OVERLAY_MIN_SCALE) return
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (topo) {
    ctx.fillStyle = TOPO.forest
    ctx.beginPath()
    for (const s of vec.forests) if (visible(s, v, 3)) trace(ctx, s, v, true)
    ctx.fill()

    ctx.fillStyle = TOPO.runway
    ctx.beginPath()
    for (const s of vec.runways) if (visible(s, v)) trace(ctx, s, v, true)
    ctx.fill()

    // Горизонтали: чем мельче масштаб, тем реже
    const every = v.scale < 0.12 ? 100 : v.scale < 0.4 ? 50 : 10
    ctx.lineWidth = 0.7
    ctx.strokeStyle = TOPO.contour
    ctx.beginPath()
    for (const c of vec.contours) {
      if (c.elevation % every !== 0 || c.elevation % 50 === 0 || !visible(c, v, 14)) continue
      trace(ctx, c, v, false)
    }
    ctx.stroke()
    ctx.lineWidth = 1.2
    ctx.strokeStyle = TOPO.contourMajor
    ctx.beginPath()
    for (const c of vec.contours) {
      if (c.elevation % 50 !== 0 || c.elevation % every !== 0 || !visible(c, v, 14)) continue
      trace(ctx, c, v, false)
    }
    ctx.stroke()
  }

  // Дороги: обводка, затем заливка; мелкие — только при приближении
  const minRoadScale: Record<RoadKind, number> = { main_road: 0, road: 0.03, track: 0.1, trail: 0.25 }
  for (const kind of ROAD_KINDS) {
    if (v.scale < minRoadScale[kind] && topo) continue
    if (!topo && v.scale < minRoadScale[kind] + 0.2) continue
    const style = TOPO.roads[kind]
    const px = Math.max(1, style.width * v.scale)
    const list = vec.roads[kind].filter((s) => visible(s, v))
    if (list.length === 0) continue
    if (topo) {
      ctx.strokeStyle = style.casing
      ctx.lineWidth = px + 1.6
      ctx.beginPath()
      for (const s of list) trace(ctx, s, v, false)
      ctx.stroke()
      ctx.strokeStyle = style.fill
      ctx.lineWidth = px
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = Math.max(1, px * 0.6)
    }
    ctx.beginPath()
    for (const s of list) trace(ctx, s, v, false)
    ctx.stroke()
  }

  // Здания
  if (v.scale >= (topo ? 0.1 : SAT_OVERLAY_MIN_SCALE)) {
    ctx.fillStyle = topo ? TOPO.houseFill : 'rgba(0,0,0,0.3)'
    ctx.strokeStyle = topo ? TOPO.houseStroke : 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const s of vec.houses) if (visible(s, v, 2)) trace(ctx, s, v, true)
    ctx.fill()
    ctx.stroke()
  }

  if (topo) {
    ctx.fillStyle = TOPO.text
    ctx.textAlign = 'center'
    if (v.scale >= 0.25) {
      ctx.font = `10px ${font}`
      for (const s of vec.spots) {
        const x = (s.x - v.x0) * v.scale
        const y = (v.y0 - s.y) * v.scale
        if (x < -20 || y < -20 || x > v.width + 20 || y > v.height + 20) continue
        ctx.fillText(String(s.elevation), x, y)
      }
    }
    ctx.font = `600 12px ${font}`
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(244,242,234,0.85)'
    for (const n of vec.names) {
      const min = NAME_MIN_SCALE[n.type] ?? 0.1
      if (v.scale < min) continue
      const x = (n.x - v.x0) * v.scale
      const y = (v.y0 - n.y) * v.scale
      if (x < -80 || y < -20 || x > v.width + 80 || y > v.height + 20) continue
      ctx.strokeText(n.name, x, y)
      ctx.fillText(n.name, x, y)
    }
  }
  ctx.restore()
}

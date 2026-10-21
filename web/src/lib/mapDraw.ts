import { readStoredText, writeStored } from './input'
import { MARKER_COLORS, type MarkerColor } from './markers'

/** Рисунок на карте: штрих — ломаная в координатах мира одного цвета. */
export interface DrawStroke {
  id: string
  color: MarkerColor
  points: { x: number; y: number }[]
}

export const MAX_STROKES = 200
const MAX_POINTS = 400

const key = (world: string) => `mapDraw:${world}`

export function readStrokes(world: string): DrawStroke[] {
  try {
    const value = JSON.parse(readStoredText(key(world))) as unknown
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (s): s is DrawStroke =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as DrawStroke).id === 'string' &&
          MARKER_COLORS.includes((s as DrawStroke).color) &&
          Array.isArray((s as DrawStroke).points) &&
          (s as DrawStroke).points.every(
            (p) => typeof p?.x === 'number' && typeof p?.y === 'number'
          )
      )
      .slice(-MAX_STROKES)
  } catch {
    return []
  }
}

export function writeStrokes(world: string, strokes: DrawStroke[]) {
  writeStored(key(world), JSON.stringify(strokes.slice(-MAX_STROKES)))
}

/** Выбросить точки ближе minStep (в метрах мира) к предыдущей; концы остаются. */
export function simplify(
  points: { x: number; y: number }[],
  minStep: number
): { x: number; y: number }[] {
  if (points.length <= 2) return points
  const out = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1]
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minStep) {
      out.push(points[i])
    }
  }
  out.push(points[points.length - 1])
  // Не больше MAX_POINTS: берём каждую n-ю
  if (out.length <= MAX_POINTS) return out
  const n = Math.ceil(out.length / MAX_POINTS)
  const thin = out.filter((_, i) => i % n === 0)
  if (thin[thin.length - 1] !== out[out.length - 1]) thin.push(out[out.length - 1])
  return thin
}

function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy))
}

/** Расстояние от точки до штриха (в метрах мира). */
export function distanceToStroke(
  stroke: DrawStroke,
  p: { x: number; y: number }
): number {
  const pts = stroke.points
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y)
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]))
  }
  return best
}

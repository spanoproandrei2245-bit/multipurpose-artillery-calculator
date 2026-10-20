import type { MapPoint } from './heightmap'

/**
 * Огонь по линии (лесополоса, дорога, траншея): линия рисуется на карте,
 * а приложение раскладывает по ней точки прицеливания так, чтобы зоны
 * поражения соседних разрывов перекрывали всю длину.
 */

export interface LineWeapon {
  id: 'mortar' | 'artillery' | 'rocket' | 'rocket-wide'
  // Радиус поражения от точки падения, м
  radius: number
}

// Радиусы по опыту игры: миномёт ±15 м, артиллерия ±50 м, РСЗО 75–100 м
export const LINE_WEAPONS: readonly LineWeapon[] = [
  { id: 'mortar', radius: 15 },
  { id: 'artillery', radius: 50 },
  { id: 'rocket', radius: 75 },
  { id: 'rocket-wide', radius: 100 },
]

export const DEFAULT_LINE_WEAPON: LineWeapon['id'] = 'mortar'

/** Длина ломаной, м. */
export function polylineLength(points: readonly MapPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

/** Точка на ломаной на расстоянии d от начала (за концом — конец). */
export function pointAlong(points: readonly MapPoint[], d: number): MapPoint {
  let rest = Math.max(0, d)
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const segment = Math.hypot(b.x - a.x, b.y - a.y)
    if (rest <= segment && segment > 0) {
      const t = rest / segment
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    rest -= segment
  }
  const last = points[points.length - 1]
  return { x: last.x, y: last.y }
}

/**
 * Точки прицеливания вдоль линии. Линию делят на n равных участков
 * шириной не больше диаметра поражения и целятся в середину каждого:
 * так концы линии тоже попадают в зону поражения.
 */
export function aimPoints(points: readonly MapPoint[], radius: number): MapPoint[] {
  if (points.length === 0 || radius <= 0) return []
  const length = polylineLength(points)
  const n = Math.max(1, Math.ceil(length / (2 * radius)))
  const step = length / n
  return Array.from({ length: n }, (_, i) => pointAlong(points, (i + 0.5) * step))
}

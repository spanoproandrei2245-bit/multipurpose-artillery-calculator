import { heightAt, type Heightmap, type MapPoint } from './heightmap'
import {
  clearance,
  isBlocked,
  isTight,
  type TerrainProfile,
} from './terrainClearance'

/**
 * Зоны на карте по рельефу.
 *
 *   from: куда можно попасть из точки, где стоит орудие;
 *   to:   откуда можно попасть в точку, где стоит цель.
 *
 * Вокруг центра строятся лучи; на каждом проверяются дальности от минимальной
 * до максимальной: есть ли решение в таблице и не упрётся ли снаряд в рельеф
 * по пути (та же проверка, что для выстрела по цели).
 */

export type CoverageStatus = 'ok' | 'tight' | 'blocked'

export interface CoverageSegment {
  // Дальности от центра, м
  from: number
  to: number
  status: CoverageStatus
}

export interface CoverageRay {
  // Направление от центра: радианы, 0 — север, по часовой
  angle: number
  segments: CoverageSegment[]
}

export interface Coverage {
  center: MapPoint
  mode: 'from' | 'to'
  // Угловая ширина луча, радианы
  width: number
  rays: CoverageRay[]
}

/** Возвышение в точку на этой дальности и разнице высот (цель минус орудие). */
export type SolveAt = (distance: number, heightDiff: number) => { elevation: number } | null

export interface CoverageInput {
  map: Heightmap
  center: MapPoint
  mode: 'from' | 'to'
  minRange: number
  maxRange: number
  solve: SolveAt
  // Лучей по кругу
  rays?: number
  // Дальностей на луче
  steps?: number
}

// Высота не больше этой — вода, м
const SEA_LEVEL = 0.5

const DEFAULT_RAYS = 120
const DEFAULT_STEPS = 48

function worse(a: CoverageStatus, b: CoverageStatus): CoverageStatus {
  const order: CoverageStatus[] = ['ok', 'tight', 'blocked']
  return order.indexOf(a) >= order.indexOf(b) ? a : b
}

export function computeCoverage({
  map,
  center,
  mode,
  minRange,
  maxRange,
  solve,
  rays = DEFAULT_RAYS,
  steps = DEFAULT_STEPS,
}: CoverageInput): Coverage {
  const width = (Math.PI * 2) / rays
  const result: CoverageRay[] = []
  if (!(maxRange > minRange) || maxRange <= 0) return { center, mode, width, rays: result }

  // Шаг высот по лучу и шаг проверяемых дальностей (кратный ему)
  const sampleStep = Math.max(10, map.step / 2)
  const wantedStep = Math.max(sampleStep, (maxRange - minRange) / steps)
  const stride = Math.max(1, Math.round(wantedStep / sampleStep))
  const cell = stride * sampleStep

  for (let r = 0; r < rays; r += 1) {
    const angle = r * width
    const dx = Math.sin(angle)
    const dy = Math.cos(angle)

    // Высоты рельефа от центра наружу, пока луч внутри карты
    const heights: number[] = []
    for (let d = 0; d <= maxRange + cell; d += sampleStep) {
      const h = heightAt(map, { x: center.x + dx * d, y: center.y + dy * d })
      if (h === null) break
      heights.push(h)
    }

    const segments: CoverageSegment[] = []
    let open: CoverageSegment | null = null
    const firstIndex = Math.max(1, Math.ceil(minRange / sampleStep / stride) * stride)
    for (let k = firstIndex; k < heights.length; k += stride) {
      const distance = k * sampleStep
      if (distance > maxRange + cell / 2) break

      const slice = heights.slice(0, k + 1)
      // «from»: орудие в центре, цель на конце луча; «to»: наоборот
      const profile: TerrainProfile = {
        distance,
        heights: mode === 'from' ? slice : slice.reverse(),
      }
      const own = profile.heights[0]
      const aim = profile.heights[profile.heights.length - 1]
      const solved = solve(distance, aim - own)

      let status: CoverageStatus | null = null
      // Стоять в воде нельзя: в режиме «to» клетки на уровне моря не считаются
      const standable = mode === 'from' || own > SEA_LEVEL
      if (solved !== null && standable) {
        const check = clearance(profile, solved.elevation)
        status = isBlocked(check) ? 'blocked' : isTight(check) ? 'tight' : 'ok'
      }

      const from = Math.max(minRange, distance - cell / 2)
      const to = Math.min(maxRange, distance + cell / 2)
      if (status === null) {
        open = null
        continue
      }
      if (open && open.status === status && Math.abs(open.to - from) < 1e-6) {
        open.to = to
      } else {
        open = { from, to, status }
        segments.push(open)
      }
    }

    result.push({ angle, segments })
  }

  return { center, mode, width, rays: result }
}

/** Худший статус на круге дальностей: для подписи «достаёт ли вообще». */
export function overallStatus(coverage: Coverage): CoverageStatus | null {
  let status: CoverageStatus | null = null
  for (const ray of coverage.rays) {
    for (const segment of ray.segments) {
      status = status === null ? segment.status : worse(status, segment.status)
    }
  }
  return status
}

export interface Suggestion {
  point: MapPoint
  // Расстояние до точки, м, от той, с которой сравнивали
  distance: number
}

/**
 * Ближайшее хорошее место (зелёный отрезок) к точке `near` и по возможности
 * подальше от цели: стоять близко к цели опаснее. Только режим «to».
 * null — хорошего места нет.
 */
export function nearestGoodSpot(coverage: Coverage, near: MapPoint): Suggestion | null {
  if (coverage.mode !== 'to') return null
  let best: Suggestion | null = null
  for (const ray of coverage.rays) {
    for (const segment of ray.segments) {
      if (segment.status !== 'ok') continue
      // Середина отрезка и его дальний край; берётся ближайшее к `near`
      for (const d of [(segment.from + segment.to) / 2]) {
        const point = {
          x: coverage.center.x + Math.sin(ray.angle) * d,
          y: coverage.center.y + Math.cos(ray.angle) * d,
        }
        const distance = Math.hypot(point.x - near.x, point.y - near.y)
        if (best === null || distance < best.distance) best = { point, distance }
      }
    }
  }
  return best
}

import type { Heightmap } from './heightmap'

/**
 * Горизонтали из сетки высот карты: метод «марширующих квадратов» только по
 * видимому участку. Сетка у карт грубая (до 22 м), зато так линии можно
 * проводить через 1-5 м, чего нет в готовых данных (там через 10 м), а при
 * приближении это и нужно, чтобы точно поставить орудие на нужную высоту.
 */

export interface ContourView {
  // Мировые координаты левого верхнего угла, м
  x0: number
  y0: number
  // Пикселей на метр
  scale: number
  width: number
  height: number
}

export interface ContourLevel {
  level: number
  // Отрезки x1, y1, x2, y2, … в метрах мира
  segments: number[]
}

/** Через сколько метров проводить линии при таком приближении; null — не рисовать. */
export function contourInterval(scale: number): number | null {
  if (scale < 0.15) return null
  if (scale < 0.5) return 5
  if (scale < 1.5) return 2
  return 1
}

/** Каждая какая линия «главная» (толще, с подписью): кратная этому числу. */
export function majorEvery(interval: number): number {
  return interval === 1 ? 5 : interval === 2 ? 10 : 25
}

export function demContours(map: Heightmap, view: ContourView, interval: number): ContourLevel[] {
  const { size, step, heights } = map
  const x1 = view.x0 + view.width / view.scale
  const y1 = view.y0
  const y0 = view.y0 - view.height / view.scale
  const i0 = Math.max(0, Math.floor(view.x0 / step))
  const i1 = Math.min(size - 2, Math.floor(x1 / step))
  const j0 = Math.max(0, Math.floor(y0 / step))
  const j1 = Math.min(size - 2, Math.floor(y1 / step))

  const byLevel = new Map<number, number[]>()
  const push = (level: number, ax: number, ay: number, bx: number, by: number) => {
    let list = byLevel.get(level)
    if (!list) byLevel.set(level, (list = []))
    list.push(ax, ay, bx, by)
  }

  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const a = heights[j * size + i]
      const b = heights[j * size + i + 1]
      const c = heights[(j + 1) * size + i + 1]
      const d = heights[(j + 1) * size + i]
      const lo = Math.min(a, b, c, d)
      const hi = Math.max(a, b, c, d)
      const x = i * step
      const y = j * step

      for (let k = Math.ceil(lo / interval); k * interval <= hi; k += 1) {
        const level = k * interval
        // Ровно на узле: чуть сдвигаем, чтобы не плодить дубликаты по соседним клеткам
        const L = level + 1e-4
        const idx = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (d > L ? 8 : 0)
        if (idx === 0 || idx === 15) continue

        // Точки на рёбрах клетки: низ (a-b), право (b-c), верх (d-c), лево (a-d)
        const bottom = (): [number, number] => [x + (step * (L - a)) / (b - a), y]
        const right = (): [number, number] => [x + step, y + (step * (L - b)) / (c - b)]
        const top = (): [number, number] => [x + (step * (L - d)) / (c - d), y + step]
        const left = (): [number, number] => [x, y + (step * (L - a)) / (d - a)]
        const seg = (p: [number, number], q: [number, number]) => push(level, p[0], p[1], q[0], q[1])

        switch (idx) {
          case 1:
          case 14:
            seg(left(), bottom())
            break
          case 2:
          case 13:
            seg(bottom(), right())
            break
          case 3:
          case 12:
            seg(left(), right())
            break
          case 4:
          case 11:
            seg(right(), top())
            break
          case 6:
          case 9:
            seg(bottom(), top())
            break
          case 7:
          case 8:
            seg(left(), top())
            break
          case 5:
            // a и c выше линии: по центру решаем, соединены ли они
            if ((a + b + c + d) / 4 > L) {
              seg(bottom(), right())
              seg(left(), top())
            } else {
              seg(left(), bottom())
              seg(right(), top())
            }
            break
          case 10:
            if ((a + b + c + d) / 4 > L) {
              seg(left(), bottom())
              seg(right(), top())
            } else {
              seg(bottom(), right())
              seg(left(), top())
            }
            break
        }
      }
    }
  }

  return [...byLevel.entries()]
    .sort((p, q) => p[0] - q[0])
    .map(([level, segments]) => ({ level, segments }))
}

const SAT = {
  minor: 'rgba(255,236,170,0.5)',
  major: 'rgba(255,214,110,0.95)',
  text: '#ffffff',
  outline: 'rgba(0,0,0,0.85)',
}
const TOPO = {
  minor: '#d1b48c',
  major: '#b58f5c',
  text: '#6b4a1f',
  outline: 'rgba(244,242,234,0.9)',
}

// Подписи высот не гуще этого, пиксели
const LABEL_GAP = 170
const MAX_LABELS = 60

/** Горизонтали и подписи высот на холст; возвращает, сколько линий нарисовано. */
export function drawDemContours(
  ctx: CanvasRenderingContext2D,
  map: Heightmap,
  view: ContourView,
  style: 'sat' | 'topo',
  font: string
): number {
  const interval = contourInterval(view.scale)
  if (interval === null) return 0
  const levels = demContours(map, view, interval)
  const palette = style === 'topo' ? TOPO : SAT
  const major = majorEvery(interval)
  const toX = (x: number) => (x - view.x0) * view.scale
  const toY = (y: number) => (view.y0 - y) * view.scale

  ctx.save()
  ctx.lineCap = 'round'
  for (const heavy of [false, true]) {
    ctx.lineWidth = heavy ? 1.3 : 0.6
    ctx.strokeStyle = heavy ? palette.major : palette.minor
    ctx.beginPath()
    for (const { level, segments } of levels) {
      if ((level % major === 0) !== heavy) continue
      for (let s = 0; s < segments.length; s += 4) {
        ctx.moveTo(toX(segments[s]), toY(segments[s + 1]))
        ctx.lineTo(toX(segments[s + 2]), toY(segments[s + 3]))
      }
    }
    ctx.stroke()
  }

  // Подписи на главных линиях: по одной на участок, не гуще LABEL_GAP
  ctx.font = `11px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  const placed: { x: number; y: number }[] = []
  for (const { level, segments } of levels) {
    if (level % major !== 0) continue
    for (let s = 0; s < segments.length && placed.length < MAX_LABELS; s += 4 * 6) {
      const px = toX((segments[s] + segments[s + 2]) / 2)
      const py = toY((segments[s + 1] + segments[s + 3]) / 2)
      if (px < 10 || py < 10 || px > view.width - 10 || py > view.height - 10) continue
      if (placed.some((p) => Math.hypot(p.x - px, p.y - py) < LABEL_GAP)) continue
      placed.push({ x: px, y: py })
      ctx.strokeStyle = palette.outline
      ctx.strokeText(String(level), px, py)
      ctx.fillStyle = palette.text
      ctx.fillText(String(level), px, py)
    }
  }
  ctx.restore()
  return levels.length
}

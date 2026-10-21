import type { ArtilleryCategory } from '../types/gameModel'
import type { ShellKind } from './shellKind'

/**
 * Анимация полёта снаряда на canvas: траектория, след и разрыв зависят
 * от класса орудия и вида снаряда. Рисуется и сбоку (полоска у таймера),
 * и «сверху» (на карте): точка падения — на земле, снаряд приподнят над
 * своей тенью на высоту дуги.
 */

// Сколько показывать последствия разрыва после падения, с
export const IMPACT_FX_SECONDS = 4

export interface FlightParams {
  category: ArtilleryCategory
  kind: ShellKind
  // Орудие и цель на земле, px холста
  ax: number
  ay: number
  bx: number
  by: number
  // Секунд с выстрела и время полёта
  elapsed: number
  tof: number
  // Высота верхней точки дуги, px
  arc: number
  // Масштаб эффектов (1 — полоска у таймера)
  scale?: number
}

// Псевдослучайное число из целого: чтобы искры и клубы не дрожали между кадрами
function rnd(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Доля высоты дуги по классу: миномёт — навесом, РСЗО — настильнее. */
function lift(category: ArtilleryCategory, t: number): number {
  const parabola = 4 * t * (1 - t)
  switch (category) {
    case 'mortar':
      return parabola
    case 'mlrs':
      return Math.pow(parabola, 0.7) * 0.55
    default:
      return parabola * 0.6
  }
}

function pathPoint(p: FlightParams, t: number) {
  const gx = p.ax + (p.bx - p.ax) * t
  const gy = p.ay + (p.by - p.ay) * t
  return { gx, gy, x: gx, y: gy - p.arc * lift(p.category, t) }
}


const INK = '240,244,248'
const WARM = '255,176,32'

// Короткий след за снарягом: точки по пройденному пути с затуханием
function drawTrail(ctx: CanvasRenderingContext2D, p: FlightParams, t: number, s: number) {
  const length = p.category === 'mlrs' ? 0.3 : p.category === 'mortar' ? 0.22 : 0.12
  const steps = 16
  for (let i = 0; i < steps; i += 1) {
    const u0 = Math.max(0, t - length * (1 - i / steps))
    const u1 = Math.max(0, t - length * (1 - (i + 1) / steps))
    const a = pathPoint(p, u0)
    const b = pathPoint(p, u1)
    const k = (i + 1) / steps
    // Миномёт — пунктир, остальные — сплошной тонкий след
    if (p.category === 'mortar' && i % 2 === 1) continue
    ctx.strokeStyle = `rgba(${INK},${0.55 * k})`
    ctx.lineWidth = (p.category === 'mlrs' ? 0.6 + k * 1.6 : 1.2) * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: FlightParams, t: number, s: number) {
  const now = pathPoint(p, t)
  // Тень на земле показывает высоту
  if (p.arc > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(now.gx, now.gy, 3 * s, 1.2 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = p.category === 'mlrs' ? `rgb(${WARM})` : `rgb(${INK})`
  ctx.beginPath()
  ctx.arc(now.x, now.y, (p.category === 'mortar' ? 2.6 : 2.1) * s, 0, Math.PI * 2)
  ctx.fill()
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, width: number, color: string) {
  if (alpha <= 0) return
  ctx.strokeStyle = `rgba(${color},${alpha})`
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

function drawHe(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  const radius = (p.category === 'mortar' ? 12 : p.category === 'mlrs' ? 18 : 15) * s
  // Ракеты — залп из трёх разрывов
  const blasts = p.category === 'mlrs' ? 3 : 1
  for (let i = 0; i < blasts; i += 1) {
    const local = e - i * 0.2
    if (local < 0) continue
    const cx = p.bx + (blasts > 1 ? (rnd(i + 1) - 0.5) * radius * 1.6 : 0)
    const cy = p.by + (blasts > 1 ? (rnd(i + 7) - 0.5) * radius * 0.6 : 0)
    // Вспышка в центре и два расходящихся кольца
    const flash = clamp01(1 - local / 0.2)
    if (flash > 0) {
      ctx.fillStyle = `rgba(${WARM},${flash})`
      ctx.beginPath()
      ctx.arc(cx, cy, 3.5 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    const k1 = clamp01(local / 0.7)
    ring(ctx, cx, cy, radius * (0.2 + k1 * 0.8), (1 - k1) * 0.9, 1.6 * s, WARM)
    const k2 = clamp01((local - 0.12) / 1.1)
    if (local > 0.12) ring(ctx, cx, cy, radius * (0.2 + k2 * 1.15), (1 - k2) * 0.5, 1 * s, INK)
  }
}

function drawIllum(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  // Яркая точка раскрывается над целью и плавно опускается, мягкое свечение
  const cx = p.bx
  const cy = p.by - 30 * s + e * 3 * s
  const fade = clamp01(1 - (e - 2.6) / 1.4)
  const open = clamp01(e / 0.35)
  const r = 40 * s * (0.4 + open * 0.6)
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, `rgba(255,244,200,${0.55 * fade})`)
  g.addColorStop(1, 'rgba(255,230,150,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${fade})`
  ctx.beginPath()
  ctx.arc(cx, cy, 2.2 * s, 0, Math.PI * 2)
  ctx.fill()
}

function drawSmoke(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  // Три мягких облачка медленно расходятся и бледнеют
  const grow = clamp01(e / 2.4)
  const alpha = 0.4 * clamp01(e / 0.3) * (1 - clamp01((e - 2.8) / 1.2))
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.6
    const d = 7 * s * grow
    const x = p.bx + Math.cos(a) * d
    const y = p.by + Math.sin(a) * d * 0.55 - e * 1.2 * s
    const r = (6 + i * 1.5) * s * (0.5 + grow)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${INK},${alpha})`)
    g.addColorStop(1, `rgba(${INK},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Один кадр анимации полёта и разрыва. */
export function drawFlight(ctx: CanvasRenderingContext2D, p: FlightParams) {
  const s = p.scale ?? 1
  if (p.elapsed < 0 || p.tof <= 0) return
  const t = p.elapsed / p.tof
  if (t < 1) {
    drawTrail(ctx, p, t, s)
    drawProjectile(ctx, p, t, s)
    return
  }
  const e = p.elapsed - p.tof
  if (e > IMPACT_FX_SECONDS) return
  switch (p.kind) {
    case 'illum':
      drawIllum(ctx, p, e, s)
      break
    case 'smoke':
      drawSmoke(ctx, p, e, s)
      break
    default:
      drawHe(ctx, p, e, s)
  }
}

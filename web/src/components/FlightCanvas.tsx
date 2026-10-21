import { useEffect, useRef } from 'react'

import { useFlightStyle } from '../lib/animation'
import { drawFlight, IMPACT_FX_SECONDS } from '../lib/flightFx'
import type { ShellKind } from '../lib/shellKind'
import type { ArtilleryCategory } from '../types/gameModel'

export interface FlightShot {
  // Момент выстрела, мс (Date.now)
  firedAt: number
  // Время полёта, с
  tof: number
}

/** Где на холсте орудие и цель (px) и высота дуги. */
export interface FlightEnds {
  ax: number
  ay: number
  bx: number
  by: number
  arc: number
  scale: number
}

interface Props {
  // Снаряды в полёте: у залпа их несколько, летят одновременно
  shots: readonly FlightShot[]
  category: ArtilleryCategory
  kind: ShellKind
  className?: string
  // Холст поверх карты: координаты берутся у карты. Без этого — линия
  // таймера: орудие слева, цель справа, дорожка с прогрессом.
  ends?: () => FlightEnds | null
  // Размер холста, px (для карты); у линии таймера — по ширине блока
  width?: number
  height?: number
  // Покой: линия без снарядов (боевой экран показывает её всегда)
  idle?: boolean
  // Красная дорожка: идут последние секунды до разрыва
  alert?: boolean
}

const TRACK_HEIGHT = 44

// Цвета рядом с картой: орудие синее, цель красная, дорожка серая, ход — акцент
const GUN = 'rgba(67,147,228,0.95)'
const TARGET = 'rgba(228,116,116,0.95)'
const TRACK = 'rgba(160,166,173,0.22)'
const ACCENT = 'rgba(67,147,228,0.95)'

/**
 * Линия таймера и анимация полёта в одном: по дорожке от орудия к цели
 * едет снаряд (у залпа — несколько), дорожка закрашивается по мере
 * полёта, у цели — разрыв. Вид зависит от орудия и снаряда (flightFx);
 * при выключенной анимации остаётся только дорожка с прогрессом.
 */
export function FlightCanvas({
  shots,
  category,
  kind,
  className,
  ends,
  width,
  height = TRACK_HEIGHT,
  idle = false,
  alert = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const style = useFlightStyle()
  // Свежие значения для цикла кадров без его перезапуска
  const latest = useRef({ category, kind, ends, width, height, style, alert, idle })
  useEffect(() => {
    latest.current = { category, kind, ends, width, height, style, alert, idle }
  })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0

    function clear() {
      if (!canvas || !ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    function tick() {
      if (!canvas || !ctx) return
      const { category, kind, ends, width, height, style, alert, idle } = latest.current
      const now = Date.now()
      const cssW = width ?? canvas.clientWidth
      const cssH = height
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr)
        canvas.height = Math.round(cssH * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      let geometry: FlightEnds | null
      if (ends) {
        geometry = ends()
      } else {
        // Линия таймера: дорожка у нижнего края, дуга снаряда над ней
        const ground = cssH - 8
        geometry = {
          ax: 8,
          ay: ground,
          bx: cssW - 10,
          by: ground,
          arc: cssH * 0.55,
          scale: 1,
        }
        ctx.lineCap = 'round'
        ctx.strokeStyle = TRACK
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(geometry.ax, ground)
        ctx.lineTo(geometry.bx, ground)
        ctx.stroke()

        // Прогресс — по самому дальнему снаряду
        const lead = shots.reduce(
          (best, s) => Math.max(best, Math.min(1, (now - s.firedAt) / 1000 / s.tof)),
          0
        )
        if (lead > 0) {
          ctx.strokeStyle = alert ? TARGET : ACCENT
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(geometry.ax, ground)
          ctx.lineTo(geometry.ax + (geometry.bx - geometry.ax) * lead, ground)
          ctx.stroke()
        }
        // Орудие — точка, цель — кольцо, как на карте
        ctx.fillStyle = GUN
        ctx.beginPath()
        ctx.arc(geometry.ax, ground, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = TARGET
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(geometry.bx, ground, 4.5, 0, Math.PI * 2)
        ctx.stroke()
      }

      let alive = false
      for (const shot of shots) {
        const elapsed = (now - shot.firedAt) / 1000
        if (elapsed < shot.tof + IMPACT_FX_SECONDS) alive = true
        // Анимация выключена: на линии таймера остаётся только прогресс
        if (geometry && !(style === 'off' && !ends)) {
          drawFlight(ctx, {
            category,
            kind,
            ax: geometry.ax,
            ay: geometry.ay,
            bx: geometry.bx,
            by: geometry.by,
            elapsed,
            tof: shot.tof,
            arc: geometry.arc,
            scale: geometry.scale,
            style: style === 'detailed' ? 'detailed' : 'minimal',
          })
        }
      }

      if (alive || idle) frame = requestAnimationFrame(tick)
      else clear()
    }

    if (shots.length === 0 && !latest.current.idle) {
      clear()
      return
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clear()
    }
  }, [shots])

  // На карте при выключенной анимации холст не нужен; линия таймера нужна всегда
  if (style === 'off' && ends) return null

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={width ? { width, height } : { width: '100%', height }}
    />
  )
}

import { useEffect, useRef } from 'react'

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
  shot: FlightShot | null
  category: ArtilleryCategory
  kind: ShellKind
  className?: string
  // Холст поверх карты: координаты берутся у карты. Без этого — боковой
  // вид: орудие слева, цель справа, земля внизу.
  ends?: () => FlightEnds | null
  // Размер холста, px (для карты); у бокового вида — по ширине блока
  width?: number
  height?: number
}

const SIDE_HEIGHT = 84

/**
 * Анимация полёта снаряда: рисуется, пока идёт полёт и показываются
 * последствия разрыва. Вид зависит от орудия и снаряда (flightFx).
 */
export function FlightCanvas({
  shot,
  category,
  kind,
  className,
  ends,
  width,
  height = SIDE_HEIGHT,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Свежие значения для цикла кадров без его перезапуска
  const latest = useRef({ category, kind, ends, width, height })
  useEffect(() => {
    latest.current = { category, kind, ends, width, height }
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

    if (!shot) {
      clear()
      return
    }

    function tick() {
      if (!canvas || !ctx || !shot) return
      const { category, kind, ends, width, height } = latest.current
      const elapsed = (Date.now() - shot.firedAt) / 1000
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
        // Боковой вид: земля, орудие слева, цель справа
        const ground = cssH - 14
        geometry = {
          ax: 22,
          ay: ground,
          bx: cssW - 26,
          by: ground,
          arc: cssH * 0.72,
          scale: 1,
        }
        ctx.strokeStyle = 'rgba(160,166,173,0.35)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(8, ground + 4)
        ctx.lineTo(cssW - 8, ground + 4)
        ctx.stroke()
        // Орудие и цель
        ctx.fillStyle = 'rgba(67,147,228,0.95)'
        ctx.beginPath()
        ctx.arc(geometry.ax, ground, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(228,116,116,0.95)'
        ctx.lineWidth = 2
        const x = geometry.bx
        ctx.beginPath()
        ctx.moveTo(x - 5, ground - 5)
        ctx.lineTo(x + 5, ground + 5)
        ctx.moveTo(x + 5, ground - 5)
        ctx.lineTo(x - 5, ground + 5)
        ctx.stroke()
      }

      if (geometry) {
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
        })
      }

      if (elapsed < shot.tof + IMPACT_FX_SECONDS) {
        frame = requestAnimationFrame(tick)
      } else {
        clear()
      }
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clear()
    }
  }, [shot])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={width ? { width, height } : { width: '100%', height }}
    />
  )
}

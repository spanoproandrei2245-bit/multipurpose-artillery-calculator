import { useEffect, useRef, useState } from 'react'

import { t } from '../i18n'
import { markerRgb, MARKER_COLORS, type MarkerColor } from '../lib/markers'

const SIZE = 132
const RING = 22

function hslToHex(h: number, s: number, l: number): MarkerColor {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsl(hex: string): { h: number; l: number } {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  if (max !== min) {
    const d = max - min
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, l: l * 100 }
}

/** Круг оттенков и ползунок яркости: любой цвет в виде #rrggbb. */
function Wheel({ value, onChange }: { value: MarkerColor; onChange: (c: MarkerColor) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const current = hexToHsl(markerRgb(value))
  const [hue, setHue] = useState(current.h)
  const [light, setLight] = useState(Math.min(80, Math.max(20, current.l)))

  function pick(event: React.PointerEvent) {
    const rect = ref.current!.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const h = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    const next = (h + 360) % 360
    setHue(next)
    onChange(hslToHex(next, 100, light))
  }

  const angle = ((hue - 90) * Math.PI) / 180
  const radius = SIZE / 2 - RING / 2
  const knob = {
    left: SIZE / 2 + Math.cos(angle) * radius - 8,
    top: SIZE / 2 + Math.sin(angle) * radius - 8,
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <div
        ref={ref}
        role="slider"
        aria-label={t('mapPicker.hue')}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hue)}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pick(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons) pick(event)
        }}
        onKeyDown={(event) => {
          const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 5 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -5 : 0
          if (!step) return
          event.preventDefault()
          const next = (hue + step + 360) % 360
          setHue(next)
          onChange(hslToHex(next, 100, light))
        }}
        className="relative cursor-pointer touch-none rounded-full"
        style={{
          width: SIZE,
          height: SIZE,
          background:
            'conic-gradient(from 0deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(0 100% 50%))',
          WebkitMask: `radial-gradient(circle, transparent ${SIZE / 2 - RING - 0.5}px, #000 ${SIZE / 2 - RING}px)`,
          mask: `radial-gradient(circle, transparent ${SIZE / 2 - RING - 0.5}px, #000 ${SIZE / 2 - RING}px)`,
        }}
      />
      {/* Ручка поверх маски */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white shadow-md"
        style={{ left: knob.left, top: knob.top, background: markerRgb(hslToHex(hue, 100, light)) }}
      />
      </div>
      <input
        type="range"
        min={15}
        max={85}
        value={light}
        aria-label={t('mapPicker.brightness')}
        onChange={(event) => {
          const l = Number(event.target.value)
          setLight(l)
          onChange(hslToHex(hue, 100, l))
        }}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, ${hslToHex(hue, 100, 15)}, ${hslToHex(hue, 100, 50)}, ${hslToHex(hue, 100, 85)})`,
        }}
      />
    </div>
  )
}

/**
 * Выбор цвета: ряд готовых цветов и «радужная» кнопка. При наведении (или
 * нажатии на телефоне) выезжает панель с кругом оттенков и ползунком яркости.
 */
export function ColorField({
  value,
  onChange,
  names,
  placement = 'top',
  compact = false,
}: {
  value: MarkerColor
  onChange: (color: MarkerColor) => void
  names: (color: MarkerColor) => string
  placement?: 'top' | 'bottom'
  // Только кнопка с текущим цветом (панель с готовыми цветами и кругом)
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const hover = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    setOpen(true)
  }
  const leave = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    closeTimer.current = window.setTimeout(() => setOpen(false), 220)
  }

  const swatch = (color: MarkerColor) => (
    <button
      key={color}
      type="button"
      role="radio"
      aria-checked={value === color}
      aria-label={names(color)}
      onClick={() => onChange(color)}
      style={{ backgroundColor: markerRgb(color) }}
      className={[
        'h-6 w-6 shrink-0 cursor-pointer rounded-full ring-offset-2 ring-offset-black',
        value === color ? 'ring-2 ring-white' : '',
      ].join(' ')}
    />
  )

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={hover}
      onPointerLeave={leave}
    >
      <div role="radiogroup" aria-label={t('mapPicker.colour')} className="flex items-center gap-1">
        {compact ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={t('mapPicker.draw-colour')}
            title={t('mapPicker.draw-colour')}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-white/15"
          >
            <span
              className="h-5 w-5 rounded-full ring-2 ring-white/70"
              style={{ backgroundColor: markerRgb(value) }}
            />
          </button>
        ) : (
          <>
            {MARKER_COLORS.map(swatch)}
            <button
              type="button"
              aria-expanded={open}
              aria-label={t('mapPicker.custom-colour')}
              title={t('mapPicker.custom-colour')}
              onClick={() => setOpen((v) => !v)}
              className="h-6 w-6 shrink-0 cursor-pointer rounded-full ring-offset-2 ring-offset-black"
              style={{
                background:
                  'conic-gradient(hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(0 100% 50%))',
              }}
            />
          </>
        )}
      </div>

      <div
        aria-hidden={!open}
        className={[
          'absolute right-0 z-40 w-[12.5rem] rounded-xl bg-black/85 p-3 shadow-xl backdrop-blur-sm transition-all duration-200',
          placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          open
            ? 'translate-y-0 opacity-100'
            : `pointer-events-none opacity-0 ${placement === 'top' ? 'translate-y-2' : '-translate-y-2'}`,
        ].join(' ')}
      >
        {compact && (
          <div className="mb-3 flex flex-wrap justify-center gap-1.5">{MARKER_COLORS.map(swatch)}</div>
        )}
        {open && (
          <div className="relative flex justify-center">
            <Wheel value={value} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  )
}

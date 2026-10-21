import { useEffect, useState } from 'react'

import type { FlightShot } from './FlightCanvas'

/**
 * Полоска между орудием и целью на плашке с координатами: пока снаряды
 * в полёте, она раскрывается и по ней едет точка от орудия к цели
 * (у залпа — по точке на снаряд).
 */
export function FlightTrack({ shots }: { shots: readonly FlightShot[] }) {
  // Доли пути каждого снаряда; пусто — ничего не летит
  const [progress, setProgress] = useState<number[]>([])

  useEffect(() => {
    if (shots.length === 0) {
      const frame = requestAnimationFrame(() => setProgress([]))
      return () => cancelAnimationFrame(frame)
    }
    let frame = 0
    const tick = () => {
      const now = Date.now()
      const live = shots.filter((s) => (now - s.firedAt) / 1000 < s.tof + 1.2)
      setProgress(
        live.map((s) => Math.min(1, Math.max(0, (now - s.firedAt) / 1000 / s.tof)))
      )
      if (live.length > 0) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [shots])

  const active = progress.length > 0
  const lead = active ? Math.max(...progress) : 0
  const landed = lead >= 1

  return (
    <span
      aria-hidden="true"
      className="relative block h-2 shrink-0 transition-[width] duration-300"
      style={{ width: active ? 'min(7rem, 14vw)' : '1.25rem' }}
    >
      <span className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-full bg-white/20" />
      {active && (
        <>
          <span
            className={[
              'absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full',
              landed ? 'bg-target' : 'bg-accent',
            ].join(' ')}
            style={{ width: `${lead * 100}%` }}
          />
          {progress.map((p, i) => (
            <span
              key={i}
              className={[
                'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2',
                p >= 1 ? 'bg-target ring-target/40' : 'bg-white ring-white/30',
              ].join(' ')}
              style={{ left: `${p * 100}%` }}
            />
          ))}
        </>
      )}
    </span>
  )
}

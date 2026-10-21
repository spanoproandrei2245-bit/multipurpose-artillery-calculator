import { useEffect, useState } from 'react'

import type { FlightShot } from './FlightCanvas'

/**
 * Полоска между орудием и целью на плашке с координатами: пока снаряд
 * в полёте, она раскрывается и по ней едет точка от орудия к цели.
 */
export function FlightTrack({ shot }: { shot: FlightShot | null }) {
  // null — снаряд не летит; число — доля пути, после разрыва держится на 1
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!shot) {
      const frame = requestAnimationFrame(() => setProgress(null))
      return () => cancelAnimationFrame(frame)
    }
    let frame = 0
    const tick = () => {
      const elapsed = (Date.now() - shot.firedAt) / 1000
      const done = elapsed >= shot.tof + 1.2
      setProgress(done ? null : Math.min(1, Math.max(0, elapsed / shot.tof)))
      if (!done) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [shot])

  const active = progress !== null
  const p = progress ?? 0
  const landed = p >= 1

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
            style={{ width: `${p * 100}%` }}
          />
          <span
            className={[
              'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2',
              landed ? 'bg-target ring-target/40' : 'bg-white ring-white/30',
            ].join(' ')}
            style={{ left: `${p * 100}%` }}
          />
        </>
      )}
    </span>
  )
}

import { useEffect, type Ref } from 'react'

import { useWakeLock } from '../lib/useWakeLock'
import type { ArtilleryMode } from '../types/artillery'
import type { Language } from '../types/settings'
import { FireTimer, type FireTimerHandle } from './FireTimer'

interface Props {
  title: string
  targetName: string | null
  charge: number
  mode: ArtilleryMode
  elevation: number
  // Готовый азимут в единицах ввода; null — не введён
  azimuth: string | null
  azimuthUnit: string
  tof: number
  timerRef: Ref<FireTimerHandle>
  onFire?: () => void
  onClose: () => void
  language: Language
}

/**
 * «Боевой экран»: только то, что нужно у орудия, крупно.
 * Экран телефона не гаснет, пока он открыт.
 */
export function CombatScreen({
  title,
  targetName,
  charge,
  mode,
  elevation,
  azimuth,
  azimuthUnit,
  tof,
  timerRef,
  onFire,
  onClose,
  language,
}: Props) {
  const ru = language === 'ru'

  useWakeLock(true)

  // Страница под экраном не прокручивается
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const big = 'font-bold leading-none tabular-nums text-app-text'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Боевой экран' : 'Combat screen'}
      className="fixed inset-0 z-50 flex flex-col overflow-auto bg-app-bg p-4 sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-app-text">
            {targetName ?? title}
          </p>
          {targetName && (
            <p className="truncate text-sm text-app-muted">{title}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer rounded-lg border border-app-border bg-app-surface px-4 py-2 text-sm text-app-text"
        >
          {ru ? 'Закрыть' : 'Close'}
        </button>
      </div>

      <div className="grid flex-1 content-center gap-8 py-6 sm:grid-cols-2">
        <div>
          <p className="text-base text-app-muted sm:text-lg">
            {ru ? 'Возвышение, мил' : 'Elevation, mil'}
          </p>
          <p className={`${big} text-[clamp(4.5rem,22vw,11rem)]`}>
            {Math.round(elevation)}
          </p>
        </div>

        <div>
          <p className="text-base text-app-muted sm:text-lg">
            {ru ? 'Азимут' : 'Azimuth'}
            {azimuth !== null && `, ${azimuthUnit}`}
          </p>
          <p
            className={`${big} text-[clamp(4.5rem,22vw,11rem)] ${azimuth === null ? 'text-app-muted' : ''}`}
          >
            {azimuth ?? '—'}
          </p>
        </div>

        <div className="flex gap-10">
          <div>
            <p className="text-base text-app-muted">
              {ru ? 'Заряд' : 'Charge'}
            </p>
            <p className={`${big} text-6xl`}>
              {charge}
              {mode === 'LOW' && (
                <span className="ml-2 align-middle text-2xl text-amber-600 dark:text-amber-300">
                  LOW
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-base text-app-muted">
              {ru ? 'Полёт, с' : 'Flight, s'}
            </p>
            <p className={`${big} text-6xl`}>{tof.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <FireTimer
        ref={timerRef}
        tof={tof}
        language={language}
        onFire={onFire}
      />

      <p className="mt-3 hidden text-center text-xs text-app-muted sm:block">
        {ru ? 'F — огонь · Esc — закрыть' : 'F — fire · Esc — close'}
      </p>
    </div>
  )
}

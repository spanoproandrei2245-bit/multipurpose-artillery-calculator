import { useEffect, type Ref } from 'react'
import { createPortal } from 'react-dom'

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

  const cell = 'rounded-xl bg-app-surface p-5 sm:p-7'
  const caption = 'text-[15px] font-medium text-app-muted'

  // Портал в <body>: экран не зависит от контекста наложения родителя.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Боевой экран' : 'Combat screen'}
      className="fixed inset-0 z-50 flex flex-col overflow-auto bg-app-bg p-3 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-app-text sm:text-2xl">
            {targetName ?? title}
          </p>
          {targetName && (
            <p className="mt-0.5 truncate text-[15px] text-app-muted">{title}</p>
          )}
        </div>

        <button type="button" onClick={onClose} className="btn shrink-0">
          {ru ? 'Закрыть' : 'Close'}
          <span className="kbd hidden sm:inline-block">Esc</span>
        </button>
      </div>

      <div className="mt-4 grid flex-1 gap-3 sm:grid-cols-2">
        <div className={cell}>
          <p className={caption}>
            {ru ? 'Возвышение' : 'Elevation'}, {ru ? 'мил' : 'mil'}
          </p>
          <p className="readout mt-3 text-[clamp(5rem,24vw,12rem)] font-semibold">
            {Math.round(elevation)}
          </p>
        </div>

        <div className={cell}>
          <p className={caption}>
            {ru ? 'Азимут' : 'Azimuth'}
            {azimuth !== null && `, ${azimuthUnit}`}
          </p>
          <p
            className={[
              'readout mt-3 text-[clamp(5rem,24vw,12rem)] font-semibold',
              azimuth === null ? 'text-app-faint' : '',
            ].join(' ')}
          >
            {azimuth ?? '—'}
          </p>
        </div>

        <div className={`${cell} flex items-end gap-12`}>
          <div>
            <p className={caption}>{ru ? 'Заряд' : 'Charge'}</p>
            <p className="readout mt-3 flex items-baseline gap-3 text-7xl font-semibold">
              {charge}
              {mode === 'LOW' && <span className="tag tag-warn">LOW</span>}
            </p>
          </div>
          <div>
            <p className={caption}>
              {ru ? 'Полёт' : 'Flight'}, {ru ? 'с' : 's'}
            </p>
            <p className="readout mt-3 text-7xl font-semibold">{tof.toFixed(1)}</p>
          </div>
        </div>

        <div className={`${cell} flex flex-col justify-center`}>
          <FireTimer
            ref={timerRef}
            tof={tof}
            language={language}
            onFire={onFire}
          />
        </div>
      </div>

      <p className="label mt-3 hidden text-center sm:block">
        F — {ru ? 'огонь' : 'fire'} · Esc — {ru ? 'закрыть' : 'close'}
      </p>
    </div>,
    document.body
  )
}

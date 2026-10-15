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

  const cell = 'bg-app-bg p-4 sm:p-6'

  // Портал в <body>: экран не зависит от контекста наложения родителя
  // (липкая панель результата иначе прячет его под шапкой).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Боевой экран' : 'Combat screen'}
      className="fixed inset-0 z-50 flex flex-col overflow-auto bg-app-bg p-3 sm:p-6"
    >
      {/* Угловые скобки прицела */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-3 sm:inset-5">
        <span className="absolute top-0 left-0 h-6 w-6 border-t border-l border-accent" />
        <span className="absolute top-0 right-0 h-6 w-6 border-t border-r border-accent" />
        <span className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-accent" />
        <span className="absolute right-0 bottom-0 h-6 w-6 border-r border-b border-accent" />
      </div>

      <div className="flex items-start justify-between gap-4 px-2 pt-2 sm:px-3">
        <div className="min-w-0">
          <p className="label text-accent">
            {ru ? 'Боевой экран' : 'Combat screen'}
          </p>
          <p className="mt-1 truncate text-xl font-light text-app-text sm:text-2xl">
            {targetName ?? title}
          </p>
          {targetName && <p className="label mt-1 truncate">{title}</p>}
        </div>

        <button type="button" onClick={onClose} className="btn shrink-0">
          {ru ? 'Закрыть' : 'Close'}
          <span className="kbd hidden sm:inline-block">Esc</span>
        </button>
      </div>

      <div className="mt-4 grid flex-1 gap-px border border-app-border bg-app-border sm:mx-3 sm:grid-cols-2">
        <div className={cell}>
          <p className="label">
            {ru ? 'Возвышение' : 'Elevation'} · {ru ? 'мил' : 'mil'}
          </p>
          <p className="readout mt-3 text-[clamp(5rem,24vw,12rem)]">
            {Math.round(elevation)}
          </p>
        </div>

        <div className={cell}>
          <p className="label">
            {ru ? 'Азимут' : 'Azimuth'}
            {azimuth !== null && ` · ${azimuthUnit}`}
          </p>
          <p
            className={[
              'readout mt-3 text-[clamp(5rem,24vw,12rem)]',
              azimuth === null ? 'text-app-faint' : '',
            ].join(' ')}
          >
            {azimuth ?? '——'}
          </p>
        </div>

        <div className={`${cell} flex items-end gap-10`}>
          <div>
            <p className="label">{ru ? 'Заряд' : 'Charge'}</p>
            <p className="readout mt-3 flex items-baseline gap-3 text-7xl">
              {String(charge).padStart(2, '0')}
              {mode === 'LOW' && <span className="tag tag-warn">LOW</span>}
            </p>
          </div>
          <div>
            <p className="label">
              {ru ? 'Полёт' : 'Flight'} · {ru ? 'с' : 's'}
            </p>
            <p className="readout mt-3 text-7xl">{tof.toFixed(1)}</p>
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

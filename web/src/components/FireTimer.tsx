import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react'

import { readStored, writeStored } from '../lib/input'
import { playSound } from '../lib/sound'
import { SegmentBar } from './FormControls'
import type { Language } from '../types/settings'

/** Управление таймером снаружи (горячие клавиши). */
export interface FireTimerHandle {
  fire: () => void
  // Выстрел с другого устройства (связка): отсчёт без повторной отправки
  remoteFire: () => void
  stop: () => void
}

interface Props {
  // Время полёта текущего решения, с
  tof: number
  language: Language
  ref?: Ref<FireTimerHandle>
  // Выстрел здесь (кнопка или клавиша) — например, сообщить связке
  onFire?: () => void
}

// За сколько секунд до разрыва предупреждать («сплэш»),
// как принято при докладе наблюдателю.
const SPLASH_WARNING_S = 5
// Сколько показывать «Разрыв» после падения
const IMPACT_HOLD_MS = 4000


interface Shot {
  firedAt: number
  tof: number
}

/**
 * Таймер «Огонь → разрыв»: отсчёт по времени полёта,
 * сигнал за 5 с до разрыва и в момент разрыва.
 */
export function FireTimer({ tof, language, ref, onFire }: Props) {
  const ru = language === 'ru'

  const [shot, setShot] = useState<Shot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(
    () => readStored('timerSound', ['on', 'off'], 'on') === 'on'
  )

  const splashSignaled = useRef(false)
  const impactSignaled = useRef(false)

  useEffect(() => {
    writeStored('timerSound', sound ? 'on' : 'off')
  }, [sound])

  // Тикаем, пока снаряд в полёте и немного после разрыва.
  useEffect(() => {
    if (!shot) return

    const interval = window.setInterval(() => {
      const current = Date.now()
      const left = shot.tof - (current - shot.firedAt) / 1000

      if (!splashSignaled.current && left <= SPLASH_WARNING_S) {
        splashSignaled.current = true
        if (sound && shot.tof > SPLASH_WARNING_S) playSound('splash')
      }
      if (!impactSignaled.current && left <= 0) {
        impactSignaled.current = true
        if (sound) playSound('impact')
      }
      if (left * 1000 < -IMPACT_HOLD_MS) {
        setShot(null)
        return
      }
      setNow(current)
    }, 100)

    return () => window.clearInterval(interval)
  }, [shot, sound])

  useImperativeHandle(ref, () => ({
    fire,
    remoteFire: start,
    stop: () => setShot(null),
  }))

  function fire() {
    start()
    onFire?.()
  }

  function start() {
    splashSignaled.current = false
    impactSignaled.current = false
    const firedAt = Date.now()
    setNow(firedAt)
    setShot({ firedAt, tof })
    // Короткий щелчок подтверждает нажатие и разблокирует звук
    // в браузере (AudioContext запускается только после жеста).
    if (sound) playSound('fire')
  }

  const left = shot ? shot.tof - (now - shot.firedAt) / 1000 : null
  const progress =
    shot && left !== null
      ? Math.min(1, Math.max(0, 1 - left / shot.tof))
      : 0

  const phase =
    left === null
      ? 'idle'
      : left <= 0
        ? 'impact'
        : left <= SPLASH_WARNING_S
          ? 'splash'
          : 'flight'

  const alert = phase === 'splash' || phase === 'impact'
  const phaseLabel = {
    idle: ru ? 'Готов' : 'Ready',
    flight: ru ? 'Полёт' : 'In flight',
    splash: ru ? 'Сплэш' : 'Splash',
    impact: ru ? 'Разрыв' : 'Impact',
  }[phase]

  return (
    <div className="mt-4 border border-app-border bg-app-raised">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={fire}
          className="flex flex-1 cursor-pointer items-center justify-center gap-3 bg-accent px-4 py-3 font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-on-accent transition-colors hover:bg-accent-strong"
        >
          {shot
            ? ru
              ? 'Огонь ещё'
              : 'Fire again'
            : ru
              ? 'Огонь'
              : 'Fire'}
          <span className="hidden border border-current px-1 text-[10px] tracking-normal opacity-70 sm:inline">
            F
          </span>
        </button>

        {shot && (
          <button
            type="button"
            onClick={() => setShot(null)}
            className="btn btn-ghost border-l border-app-border"
          >
            {ru ? 'Стоп' : 'Stop'}
          </button>
        )}

        <button
          type="button"
          aria-pressed={sound}
          onClick={() => setSound((value) => !value)}
          title={ru ? 'Звуковой сигнал' : 'Sound'}
          className={[
            'btn btn-ghost border-l border-app-border',
            sound ? 'text-app-text' : 'text-app-faint line-through',
          ].join(' ')}
        >
          {ru ? 'Звук' : 'Sound'}
        </button>
      </div>

      <div className="border-t border-app-border px-3 py-2.5" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <span className={['label', alert ? 'text-danger' : ''].join(' ')}>
            {phaseLabel}
            {phase === 'idle' &&
              ` · ${ru ? 'сигнал за' : 'beep at'} ${SPLASH_WARNING_S} ${ru ? 'с' : 's'}`}
          </span>
          <span
            className={[
              'mono-num text-xl',
              alert ? 'text-danger' : 'text-app-text',
            ].join(' ')}
          >
            {left === null
              ? `T ${tof.toFixed(1)}`
              : phase === 'impact'
                ? 'T 0.0'
                : `T−${left.toFixed(1)}`}
            <span className="ml-1 text-[11px] text-app-muted">
              {ru ? 'с' : 's'}
            </span>
          </span>
        </div>
        <SegmentBar progress={progress} alert={alert} className="mt-2" />
      </div>
    </div>
  )
}

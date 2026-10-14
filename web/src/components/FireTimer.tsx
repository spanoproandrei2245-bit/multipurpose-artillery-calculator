import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react'

import { readStored, writeStored } from '../lib/input'
import { playSound } from '../lib/sound'
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

  return (
    <div className="mt-5 rounded-lg border border-app-border bg-app-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={fire}
          className="cursor-pointer rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          {shot
            ? ru
              ? 'Огонь ещё'
              : 'Fire again'
            : ru
              ? 'Огонь!'
              : 'Fire!'}
        </button>

        <div className="ml-auto flex gap-2">
          {shot && (
            <button
              type="button"
              onClick={() => setShot(null)}
              className="cursor-pointer rounded-lg border border-app-border bg-app-bg px-3 py-1 text-xs text-app-text"
            >
              {ru ? 'Стоп' : 'Stop'}
            </button>
          )}

          <button
            type="button"
            aria-pressed={sound}
            onClick={() => setSound((value) => !value)}
            title={ru ? 'Звуковой сигнал' : 'Sound'}
            className="cursor-pointer rounded-lg border border-app-border bg-app-bg px-3 py-1 text-xs text-app-text"
          >
            {sound
              ? ru
                ? 'Звук вкл.'
                : 'Sound on'
              : ru
                ? 'Звук выкл.'
                : 'Sound off'}
          </button>
        </div>
      </div>

      <div className="mt-2" aria-live="polite">
        {phase === 'idle' && (
          <p className="text-xs text-app-muted">
            {ru
              ? `Нажмите в момент выстрела: отсчёт ${tof.toFixed(1)} с до разрыва, сигнал за ${SPLASH_WARNING_S} с.`
              : `Press when the round is fired: ${tof.toFixed(1)} s to impact, beep ${SPLASH_WARNING_S} s before.`}
          </p>
        )}

        {phase !== 'idle' && left !== null && (
          <>
            <p
              className={[
                'text-lg font-semibold tabular-nums',
                phase === 'splash' || phase === 'impact'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-app-text',
              ].join(' ')}
            >
              {phase === 'impact'
                ? ru
                  ? 'Разрыв!'
                  : 'Impact!'
                : `${ru ? 'До разрыва' : 'Impact in'} ${left.toFixed(1)} ${ru ? 'с' : 's'}${
                    phase === 'splash' ? (ru ? ' — сплэш' : ' — splash') : ''
                  }`}
            </p>

            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-app-bg">
              <div
                className={[
                  'h-full rounded-full',
                  phase === 'flight' ? 'bg-emerald-500' : 'bg-red-500',
                ].join(' ')}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'

import { t } from '../i18n'
import { playSound } from '../lib/sound'
import { shellKind } from '../lib/shellKind'
import { useTimerSound } from '../lib/timerSound'
import type { ArtilleryCategory } from '../types/gameModel'
import { FieldIcon } from './FieldIcon'
import { FlightCanvas, type FlightShot } from './FlightCanvas'
import { ProgressBar } from './FormControls'

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
  ref?: Ref<FireTimerHandle>
  // Выстрел здесь (кнопка или клавиша) — например, сообщить связке
  onFire?: () => void
  // Класс орудия и тип снаряда — от них зависит анимация полёта
  category?: ArtilleryCategory
  shellType?: string
  // Полёт начался (shot) или закончился / остановлен (null)
  onShotChange?: (shot: FlightShot | null) => void
  // bar — кнопка «Огонь» вверху страницы: полоса состояния появляется только в полёте;
  // full — боевой экран: полоса состояния видна всегда
  variant?: 'bar' | 'full'
  // Нет решения — стрелять нечем
  disabled?: boolean
  // Кнопка боевого экрана рядом с «Огонь»
  onCombat?: () => void
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
export function FireTimer({
  tof,
  ref,
  onFire,
  category = 'mortar',
  shellType = 'HE',
  onShotChange,
  variant = 'full',
  disabled = false,
  onCombat,
}: Props) {
  const [shot, setShot] = useState<Shot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const sound = useTimerSound()

  const shotChangeRef = useRef(onShotChange)
  useEffect(() => {
    shotChangeRef.current = onShotChange
  })
  useEffect(() => {
    shotChangeRef.current?.(shot)
  }, [shot])

  const splashSignaled = useRef(false)
  const impactSignaled = useRef(false)

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
    if (disabled) return
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
    idle: t('fireTimer.ready'),
    flight: t('fireTimer.in-flight'),
    splash: t('fireTimer.splash'),
    impact: t('fireTimer.impact'),
  }[phase]

  const bar = variant === 'bar'
  const showStatus = !bar || shot !== null

  return (
    <div className={bar ? '' : 'mt-4 rounded-lg bg-app-surface p-3'}>
      <div className="flex gap-2">
        <button
          type="button"
          data-tour="fire"
          disabled={disabled}
          onClick={fire}
          className="btn btn-primary btn-lg flex-1"
        >
          <FieldIcon name="fire" className="h-5 w-5" />
          {shot ? t('fireTimer.fire-again') : t('fireTimer.fire')}
          <span className="hidden rounded bg-white/20 px-1.5 text-[12px] font-medium sm:inline">
            F
          </span>
        </button>

        {shot && (
          <button
            type="button"
            onClick={() => setShot(null)}
            className="btn min-h-12"
          >
            <FieldIcon name="stop" className="h-4 w-4" />
            {t('fireTimer.stop')}
          </button>
        )}

        {onCombat && (
          <button
            type="button"
            disabled={disabled}
            onClick={onCombat}
            title={`${t('artilleryCalculator.combat-screen')} (B)`}
            aria-label={t('artilleryCalculator.combat-screen')}
            className="btn min-h-12 w-12 shrink-0 px-0"
          >
            <FieldIcon name="combat" className="h-6 w-6" />
          </button>
        )}
      </div>

      {shot && (
        <FlightCanvas
          shot={shot}
          category={category}
          kind={shellKind(shellType)}
          className="mt-2 block"
        />
      )}

      {showStatus && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <span className={['label', alert ? 'text-danger' : ''].join(' ')}>
              {phaseLabel}
              {phase === 'idle' &&
                ` · ${t('fireTimer.beep-at')} ${SPLASH_WARNING_S} ${t('unit.s')}`}
            </span>
            <span
              className={[
                'text-xl font-semibold tabular-nums',
                alert ? 'text-danger' : 'text-app-text',
              ].join(' ')}
            >
              {left === null
                ? tof.toFixed(1)
                : phase === 'impact'
                  ? '0.0'
                  : left.toFixed(1)}
              <span className="ml-1 text-[13px] font-normal text-app-muted">
                {t('unit.s')}
              </span>
            </span>
          </div>
          <ProgressBar progress={progress} alert={alert} className="mt-2" />
        </div>
      )}
    </div>
  )
}

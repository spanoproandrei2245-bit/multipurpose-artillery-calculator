import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'

import { t } from '../i18n'
import { useFeature } from '../lib/features'
import { playSound } from '../lib/sound'
import { shellKind } from '../lib/shellKind'
import { useTimerSound } from '../lib/timerSound'
import type { ArtilleryCategory } from '../types/gameModel'
import { FieldIcon } from './FieldIcon'
import { FlightCanvas, type FlightShot } from './FlightCanvas'

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
  // Снаряды в полёте изменились (старт, залп, разрыв, стоп)
  onShotChange?: (shots: FlightShot[]) => void
  // bar — кнопка «Огонь» вверху страницы: линия полёта появляется только в полёте;
  // full — боевой экран: линия видна всегда
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

interface Shot extends FlightShot {
  id: number
}

/**
 * Таймер «Огонь → разрыв»: отсчёт по времени полёта, сигнал за 5 с до
 * разрыва и в момент разрыва. Линия таймера — она же анимация полёта.
 * Если включён «залп», в полёте появляется кнопка «+ снаряд»: ещё один
 * снаряд летит рядом с предыдущими, видно, когда упадёт каждый.
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
  const [shots, setShots] = useState<Shot[]>([])
  const [now, setNow] = useState(() => Date.now())
  const sound = useTimerSound()
  const volley = useFeature('volley')
  const nextId = useRef(1)
  // Короткие отметки для анимаций: отдача кнопки и «волна» при попадании
  const [kicking, setKicking] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const kickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(kickTimer.current)
      clearTimeout(pulseTimer.current)
    },
    []
  )
  // Какие сигналы у какого снаряда уже прозвучали
  const signaled = useRef(new Map<number, { splash: boolean; impact: boolean }>())

  const shotChangeRef = useRef(onShotChange)
  useEffect(() => {
    shotChangeRef.current = onShotChange
  })
  useEffect(() => {
    shotChangeRef.current?.(shots)
  }, [shots])

  // Тикаем, пока снаряд в полёте и немного после разрыва.
  const active = shots.length > 0
  useEffect(() => {
    if (!active) return

    const interval = window.setInterval(() => {
      const current = Date.now()
      let changed = false
      const kept: Shot[] = []
      for (const shot of shots) {
        const left = shot.tof - (current - shot.firedAt) / 1000
        const flags = signaled.current.get(shot.id) ?? { splash: false, impact: false }
        if (!flags.splash && left <= SPLASH_WARNING_S) {
          flags.splash = true
          if (sound && shot.tof > SPLASH_WARNING_S) playSound('splash')
        }
        if (!flags.impact && left <= 0) {
          flags.impact = true
          if (sound) playSound('impact')
          setPulsing(true)
          clearTimeout(pulseTimer.current)
          pulseTimer.current = setTimeout(() => setPulsing(false), 900)
        }
        signaled.current.set(shot.id, flags)
        if (left * 1000 < -IMPACT_HOLD_MS) {
          changed = true
          signaled.current.delete(shot.id)
        } else {
          kept.push(shot)
        }
      }
      if (changed) setShots(kept)
      setNow(current)
    }, 100)

    return () => window.clearInterval(interval)
  }, [active, shots, sound])

  useImperativeHandle(ref, () => ({
    fire,
    remoteFire: () => start(false),
    stop: () => setShots([]),
  }))

  function fire() {
    if (disabled) return
    start(false)
    onFire?.()
  }

  // append — добавить к летящим (залп), иначе начать заново
  function start(append: boolean) {
    const firedAt = Date.now()
    const shot: Shot = { id: nextId.current++, firedAt, tof }
    signaled.current = append ? signaled.current : new Map()
    setNow(firedAt)
    setShots((list) => (append ? [...list, shot] : [shot]))
    setKicking(true)
    clearTimeout(kickTimer.current)
    kickTimer.current = setTimeout(() => setKicking(false), 450)
    // Короткий щелчок подтверждает нажатие и разблокирует звук
    // в браузере (AudioContext запускается только после жеста).
    if (sound) playSound('fire')
  }

  // Ближайший разрыв (или последний, если все уже упали)
  const lefts = shots.map((s) => s.tof - (now - s.firedAt) / 1000)
  const pending = lefts.filter((l) => l > 0)
  const left = shots.length === 0 ? null : pending.length > 0 ? Math.min(...pending) : Math.max(...lefts)

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
  const showStatus = !bar || active

  return (
    <div
      className={[
        bar ? 'rounded-lg' : 'mt-4 rounded-lg bg-app-surface p-3',
        pulsing ? 'impact-pulse' : '',
      ].join(' ')}
    >
      <div className="flex gap-2">
        <button
          type="button"
          data-tour="fire"
          disabled={disabled}
          onClick={fire}
          className={`btn btn-primary btn-lg flex-1 ${kicking ? 'fire-kick' : ''}`}
        >
          <FieldIcon name="fire" className="h-5 w-5" />
          {active ? t('fireTimer.fire-again') : t('fireTimer.fire')}
          <span className="hidden rounded bg-white/20 px-1.5 text-[12px] font-medium sm:inline">
            F
          </span>
        </button>

        {volley && active && (
          <button
            type="button"
            onClick={() => start(true)}
            title={t('fireTimer.add-shell-title')}
            className="btn min-h-12"
          >
            <FieldIcon name="plus" className="h-4 w-4" />
            {t('fireTimer.add-shell')}
          </button>
        )}

        {active && (
          <button
            type="button"
            onClick={() => setShots([])}
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

      {showStatus && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <span className={['label', alert ? 'text-danger' : ''].join(' ')}>
              {phaseLabel}
              {shots.length > 1 && ` · ×${shots.length}`}
              {phase === 'idle' &&
                ` · ${t('fireTimer.beep-at')} ${SPLASH_WARNING_S} ${t('unit.s')}`}
            </span>
            <span
              className={[
                'text-xl font-semibold tabular-nums',
                alert ? 'text-danger' : 'text-app-text',
              ].join(' ')}
            >
              <span className={pulsing && phase === 'impact' ? 'impact-jump' : ''}>
                {left === null
                  ? tof.toFixed(1)
                  : phase === 'impact'
                    ? '0.0'
                    : left.toFixed(1)}
              </span>
              <span className="ml-1 text-[13px] font-normal text-app-muted">
                {t('unit.s')}
              </span>
            </span>
          </div>
          {/* Линия таймера: по ней летит снаряд, она же показывает прогресс */}
          <FlightCanvas
            shots={shots}
            category={category}
            kind={shellKind(shellType)}
            alert={alert}
            idle={!bar}
            className="mt-1 block"
          />
        </div>
      )}
    </div>
  )
}

import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'
import { useEffect, useRef, useState } from 'react'

import { parseNumber, readStoredText, writeStored } from '../lib/input'
import { planMrsi, type MrsiOption } from '../lib/mrsi'
import { playSound } from '../lib/sound'
import { NumberField } from './FormControls'

interface Props {
  options: readonly MrsiOption[]
  // Показывать режим у выстрела (у модели есть HIGH и LOW)
  showMode: boolean
}

const DEFAULT_GAP = 4
// Сигналы перед выстрелом, с
const COUNTDOWN = [3, 2, 1]

/**
 * Одновременный удар (MRSI): одно орудие стреляет на разных зарядах
 * с задержками, и все снаряды падают на цель одновременно.
 */
export function MrsiPanel({ options, showMode, }: Props) {
  const unitS = t('unit.s')
  const unitMil = t('unit.mil')

  const [gap, setGap] = useState(
    () => readStoredText('mrsiGap') || String(DEFAULT_GAP)
  )
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // Какие сигналы уже прозвучали: «индекс выстрела:секунда»
  const signaled = useRef(new Set<string>())

  useEffect(() => writeStored('mrsiGap', gap), [gap])

  const minGap = Math.max(0, parseNumber(gap) ?? DEFAULT_GAP)
  const plan = planMrsi(options, minGap)
  const impactAt = plan.length > 0 ? plan[0].tof : 0

  // План для таймера без перезапуска интервала на каждый рендер
  const planRef = useRef(plan)
  useEffect(() => {
    planRef.current = plan
  })

  useEffect(() => {
    if (startedAt === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      const elapsed = (current - startedAt) / 1000

      planRef.current.forEach((shot, index) => {
        for (const second of COUNTDOWN) {
          const key = `${index}:${second}`
          if (elapsed >= shot.fireAt - second && !signaled.current.has(key)) {
            signaled.current.add(key)
            if (elapsed < shot.fireAt) playSound('mrsiTick')
          }
        }
        const key = `${index}:fire`
        if (elapsed >= shot.fireAt && !signaled.current.has(key)) {
          signaled.current.add(key)
          playSound('mrsiFire')
        }
      })

      if (elapsed > impactAt + 3) {
        setStartedAt(null)
        return
      }
      setNow(current)
    }, 100)
    return () => window.clearInterval(interval)
  }, [startedAt, impactAt])

  if (plan.length < 2) return null

  const elapsed = startedAt === null ? null : (now - startedAt) / 1000
  const nextIndex =
    elapsed === null ? -1 : plan.findIndex((shot) => shot.fireAt > elapsed)

  function start() {
    signaled.current = new Set()
    const at = Date.now()
    setNow(at)
    setStartedAt(at)
    playSound('fire')
  }

  return (
    <details className="disclosure mt-4 rounded-lg bg-app-raised p-3">
      <summary>
        <span className="inline-flex items-center gap-2 text-app-text">
          <FieldIcon name="stack" className="h-5 w-5 text-app-muted" />
          {t('mrsiPanel.simultaneous-impact-mrsi')}
        </span>
        <span className="tag">
          {plan.length} {t('mrsiPanel.rounds')}
        </span>
      </summary>

      <p className="mt-2 text-xs text-app-muted">
        {t('mrsiPanel.one-gun-fires-on-different')}
      </p>

      <NumberField
        id="mrsi-gap"
        icon="reload"
        className="mt-3"
        label={t('mrsiPanel.reload-between-rounds-s')}
        value={gap}
        onChange={setGap}
      />

      <ol className="mt-3 divide-y divide-app-border overflow-hidden rounded-lg text-[12px]">
        {plan.map((shot, index) => {
          const done = elapsed !== null && elapsed >= shot.fireAt
          const next = index === nextIndex
          return (
            <li
              key={`${shot.mode}-${shot.charge}`}
              className={[
                'flex flex-wrap justify-between gap-2 border-l-2 px-2 py-1.5 tabular-nums',
                next ? 'border-l-accent bg-accent-soft' : 'border-l-transparent',
                done ? 'text-app-faint line-through' : 'text-app-text',
              ].join(' ')}
            >
              <span>
                {index === 0
                  ? t('mrsiPanel.now')
                  : `+${shot.fireAt.toFixed(1)} ${unitS}`}
              </span>
              <span>
                {t('mrsiPanel.charge')} {shot.charge}
                {showMode && ` ${shot.mode}`} · {Math.round(shot.elevation)}{' '}
                {unitMil}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-3" aria-live="polite">
        <button
          type="button"
          onClick={start}
          className="btn btn-primary"
        >
          <FieldIcon name="fire" />
          {startedAt === null
            ? t('mrsiPanel.start-mrsi')
            : t('mrsiPanel.restart')}
        </button>
        {startedAt !== null && (
          <button
            type="button"
            onClick={() => setStartedAt(null)}
            className="btn"
          >
            {t('fireTimer.stop')}
          </button>
        )}

        <p className="mono-num text-[12px] text-app-text">
          {elapsed === null
            ? `${t('mrsiPanel.impact-after')} ${impactAt.toFixed(1)} ${unitS} ${t('mrsiPanel.from-the-first-round')}`
            : nextIndex >= 0
              ? `${t('mrsiPanel.round')} ${nextIndex + 1} ${t('mrsiPanel.in')} ${(plan[nextIndex].fireAt - elapsed).toFixed(1)} ${unitS}`
              : impactAt - elapsed > 0
                ? `${t('mrsiPanel.impact-in')} ${(impactAt - elapsed).toFixed(1)} ${unitS}`
                : t('mrsiPanel.impact')}
        </p>
      </div>
    </details>
  )
}

import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'
import { useEffect, useRef, useState } from 'react'

import { parseNumber, readStoredText, writeStored } from '../lib/input'
import { planMrsi, type MrsiOption } from '../lib/mrsi'
import { playSound } from '../lib/sound'
import { InlineNumber, ProgressBar } from './FormControls'

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
 *
 * Сверху перезарядка и время до общего разрыва, крупно — следующий выстрел
 * (заряд, возвышение, обратный отсчёт), ниже план всех выстрелов.
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

  const elapsed = startedAt === null ? null : (now - startedAt) / 1000
  const nextIndex =
    elapsed === null ? 0 : plan.findIndex((shot) => shot.fireAt > elapsed)
  const next = nextIndex >= 0 ? plan[nextIndex] : null

  function start() {
    signaled.current = new Set()
    const at = Date.now()
    setNow(at)
    setStartedAt(at)
    playSound('fire')
  }

  // Крупная строка: что делать сейчас
  let status: string
  if (elapsed === null) status = `${t('mrsiPanel.impact-after')} ${impactAt.toFixed(1)} ${unitS} ${t('mrsiPanel.from-the-first-round')}`
  else if (next) status = `${t('mrsiPanel.round')} ${nextIndex + 1} ${t('mrsiPanel.in')} ${Math.max(0, next.fireAt - elapsed).toFixed(1)} ${unitS}`
  else if (impactAt - elapsed > 0) status = `${t('mrsiPanel.impact-in')} ${(impactAt - elapsed).toFixed(1)} ${unitS}`
  else status = t('mrsiPanel.impact')

  return (
    // Сворачивается, как «Огонь по времени» и «Корректировка огня»
    <details className="disclosure panel p-4 sm:p-5" open>
      <summary>
        <span className="inline-flex min-w-0 items-center gap-2 text-app-text">
          <FieldIcon name="stack" className="h-5 w-5 shrink-0 text-app-muted" />
          {t('mrsiPanel.simultaneous-impact-mrsi')}
        </span>
        <span className="tag shrink-0">
          {plan.length} {t('mrsiPanel.rounds')}
        </span>
      </summary>

      {/* Перезарядка: от неё зависит, какие заряды успеют войти в залп */}
      <label className="mt-3 flex items-center justify-between gap-3 text-[14px] text-app-text-2">
        <span className="flex items-center gap-2">
          <FieldIcon name="reload" className="h-[18px] w-[18px] text-app-muted" />
          {t('mrsiPanel.reload')}
        </span>
        <span className="flex w-28 items-center gap-2">
          <InlineNumber id="mrsi-gap" value={gap} onChange={setGap} unit={unitS} block />
        </span>
      </label>

      {plan.length < 2 ? (
        <p className="mt-3 rounded-md bg-app-raised px-3 py-2 text-[13px] text-app-muted">
          {t('mrsiPanel.not-enough')}
        </p>
      ) : (
        <>
          {/* Следующий выстрел крупно */}
          <div className="mt-3 rounded-lg bg-app-raised p-3">
            <p className="text-[13px] text-app-muted tabular-nums" aria-live="polite">{status}</p>
            {next && (
              <div className="mt-1 grid grid-cols-2 gap-2 tabular-nums">
                <div>
                  <p className="text-[12px] text-app-muted">{t('artilleryCalculator.charge')}</p>
                  <p className="text-[22px] leading-tight font-semibold text-app-text">
                    {next.charge}
                    {showMode && <span className="ml-1.5 text-[13px] font-normal text-app-muted">{next.mode}</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-app-muted">{t('artilleryCalculator.elevation')}</p>
                  <p className="text-[22px] leading-tight font-semibold whitespace-nowrap text-app-text">
                    {Math.round(next.elevation)}
                    <span className="text-[13px] font-normal text-app-muted"> {unitMil}</span>
                  </p>
                </div>
              </div>
            )}
            {elapsed !== null && (
              <ProgressBar className="mt-3" progress={impactAt > 0 ? elapsed / impactAt : 1} />
            )}
          </div>

          {/* План: когда, заряд, возвышение; выстрелянные зачёркнуты */}
          <ol className="mt-2 overflow-hidden rounded-lg text-[14px] tabular-nums">
            {plan.map((shot, index) => {
              const done = elapsed !== null && elapsed >= shot.fireAt
              const current = index === nextIndex
              return (
                <li
                  key={`${shot.mode}-${shot.charge}`}
                  className={[
                    'grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 border-l-2 px-2.5 py-1.5',
                    current ? 'border-l-accent bg-accent-soft text-app-text' : 'border-l-transparent',
                    done ? 'text-app-faint line-through' : current ? '' : 'text-app-text-2',
                  ].join(' ')}
                >
                  <b className={done ? '' : 'text-app-text'}>{index + 1}</b>
                  <span>{index === 0 ? t('mrsiPanel.now') : `+${shot.fireAt.toFixed(1)} ${unitS}`}</span>
                  <span>
                    {t('mrsiPanel.charge')} {shot.charge}
                    {showMode && ` ${shot.mode}`}
                  </span>
                  <span className="text-right font-medium">
                    {Math.round(shot.elevation)} {unitMil}
                  </span>
                </li>
              )
            })}
          </ol>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={start} className="btn btn-primary flex-1">
              <FieldIcon name="fire" />
              {startedAt === null ? t('mrsiPanel.start-mrsi') : t('mrsiPanel.restart')}
            </button>
            {startedAt !== null && (
              <button type="button" onClick={() => setStartedAt(null)} className="btn">
                <FieldIcon name="stop" />
                {t('fireTimer.stop')}
              </button>
            )}
          </div>
        </>
      )}
    </details>
  )
}

/** Опция включена, но у орудия одновременного удара нет: почему. */
export function MrsiUnavailable() {
  return (
    <p className="panel flex items-start gap-2 px-4 py-3 text-[13px] text-app-muted">
      <FieldIcon name="stack" className="mt-0.5 h-4 w-4 shrink-0" />
      {t('mrsiPanel.unavailable')}
    </p>
  )
}

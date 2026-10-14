import { useEffect, useRef, useState } from 'react'

import { parseNumber, readStoredText, writeStored } from '../lib/input'
import { planMrsi, type MrsiOption } from '../lib/mrsi'
import { playSound } from '../lib/sound'
import type { Language } from '../types/settings'
import { NumberField } from './FormControls'

interface Props {
  options: readonly MrsiOption[]
  // Показывать режим у выстрела (у модели есть HIGH и LOW)
  showMode: boolean
  language: Language
}

const DEFAULT_GAP = 4
// Сигналы перед выстрелом, с
const COUNTDOWN = [3, 2, 1]

/**
 * Одновременный удар (MRSI): одно орудие стреляет на разных зарядах
 * с задержками, и все снаряды падают на цель одновременно.
 */
export function MrsiPanel({ options, showMode, language }: Props) {
  const ru = language === 'ru'
  const unitS = ru ? 'с' : 's'
  const unitMil = ru ? 'мил' : 'mil'

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
    <details className="mt-4 rounded-lg border border-app-border bg-app-surface p-3">
      <summary className="cursor-pointer text-sm font-semibold text-app-text">
        {ru ? 'Одновременный удар (MRSI)' : 'Simultaneous impact (MRSI)'}
        <span className="ml-2 text-xs font-normal text-app-muted">
          {plan.length} {ru ? 'выстр.' : 'rounds'}
        </span>
      </summary>

      <p className="mt-2 text-xs text-app-muted">
        {ru
          ? 'Одно орудие стреляет на разных зарядах с задержками — все снаряды падают на цель одновременно.'
          : 'One gun fires on different charges with delays so that all rounds land at the same time.'}
      </p>

      <NumberField
        id="mrsi-gap"
        className="mt-3"
        label={ru ? 'Перезарядка между выстрелами, с' : 'Reload between rounds, s'}
        value={gap}
        onChange={setGap}
      />

      <ol className="mt-3 space-y-1 text-sm">
        {plan.map((shot, index) => {
          const done = elapsed !== null && elapsed >= shot.fireAt
          const next = index === nextIndex
          return (
            <li
              key={`${shot.mode}-${shot.charge}`}
              className={[
                'flex flex-wrap justify-between gap-2 rounded-md px-2 py-1 tabular-nums',
                next ? 'bg-emerald-500/15 text-app-text' : '',
                done ? 'text-app-muted line-through' : 'text-app-text',
              ].join(' ')}
            >
              <span>
                {index === 0 ? '0.0' : `+${shot.fireAt.toFixed(1)}`} {unitS}
              </span>
              <span>
                {ru ? 'заряд' : 'charge'} {shot.charge}
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
          className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          {startedAt === null
            ? ru
              ? 'Старт MRSI'
              : 'Start MRSI'
            : ru
              ? 'Заново'
              : 'Restart'}
        </button>
        {startedAt !== null && (
          <button
            type="button"
            onClick={() => setStartedAt(null)}
            className="cursor-pointer rounded-lg border border-app-border bg-app-bg px-3 py-1 text-xs text-app-text"
          >
            {ru ? 'Стоп' : 'Stop'}
          </button>
        )}

        <p className="text-sm tabular-nums text-app-text">
          {elapsed === null
            ? `${ru ? 'Удар через' : 'Impact after'} ${impactAt.toFixed(1)} ${unitS} ${ru ? 'после первого выстрела' : 'from the first round'}`
            : nextIndex >= 0
              ? `${ru ? 'Выстрел' : 'Round'} ${nextIndex + 1} ${ru ? 'через' : 'in'} ${(plan[nextIndex].fireAt - elapsed).toFixed(1)} ${unitS}`
              : impactAt - elapsed > 0
                ? `${ru ? 'Удар через' : 'Impact in'} ${(impactAt - elapsed).toFixed(1)} ${unitS}`
                : ru
                  ? 'Разрыв!'
                  : 'Impact!'}
        </p>
      </div>
    </details>
  )
}

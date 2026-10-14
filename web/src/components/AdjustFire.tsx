import { useEffect, useState } from 'react'

import {
  observerToGun,
  reportToAdjustment,
  sumAdjustments,
  type Adjustment,
} from '../lib/adjust'
import { degToMil } from '../lib/ballistics'
import {
  formatSigned,
  isInvalid,
  parseNumber,
  readStored,
  readStoredText,
  writeStored,
} from '../lib/input'
import type { AngleUnit } from '../lib/journal'
import type { Language } from '../types/settings'
import { NumberField, Toggle } from './FormControls'

export interface AdjustmentEntry extends Adjustment {
  // Как доклад был введён — для истории
  label: string
}

type Frame = 'gun' | 'observer'

interface Props {
  history: readonly AdjustmentEntry[]
  onAdd: (entry: AdjustmentEntry) => void
  onUndo: () => void
  onReset: () => void
  // Азимут орудие → цель, мил; нужен для режима наблюдателя
  gunAzimuthMil: number | null
  azimuthUnit: AngleUnit
  language: Language
}

/**
 * Пристрелка по докладу: где лёг разрыв относительно цели.
 * Доклад можно вести по линии орудия или по линии наблюдателя —
 * во втором случае он пересчитывается в линию орудие — цель.
 * Доклады складываются; последний можно отменить.
 */
export function AdjustFire({
  history,
  onAdd,
  onUndo,
  onReset,
  gunAzimuthMil,
  azimuthUnit,
  language,
}: Props) {
  const ru = language === 'ru'
  const unitM = ru ? 'м' : 'm'
  const unitAngle = azimuthUnit === 'mil' ? (ru ? 'мил' : 'mil') : '°'

  const [frame, setFrame] = useState<Frame>(() =>
    readStored<Frame>('adjustFrame', ['gun', 'observer'], 'gun')
  )
  // Наблюдатель обычно не двигается между разрывами — запоминаем.
  const [observerAzimuth, setObserverAzimuth] = useState(() =>
    readStoredText('observerAzimuth')
  )

  const [rangeMiss, setRangeMiss] = useState('')
  const [rangeSide, setRangeSide] = useState<'short' | 'over'>('over')
  const [lateralMiss, setLateralMiss] = useState('')
  const [lateralSide, setLateralSide] = useState<'left' | 'right'>('left')

  useEffect(() => writeStored('adjustFrame', frame), [frame])
  useEffect(
    () => writeStored('observerAzimuth', observerAzimuth),
    [observerAzimuth]
  )

  const total = sumAdjustments(history)

  const rangeValue = Math.abs(parseNumber(rangeMiss) ?? 0)
  const lateralValue = Math.abs(parseNumber(lateralMiss) ?? 0)

  const observerValue = parseNumber(observerAzimuth)
  const observerMil =
    observerValue === null
      ? null
      : azimuthUnit === 'mil'
        ? observerValue
        : degToMil(observerValue)

  const observerReady =
    frame === 'gun' || (observerMil !== null && gunAzimuthMil !== null)

  const canAdd =
    (rangeValue > 0 || lateralValue > 0) &&
    !isInvalid(rangeMiss) &&
    !isInvalid(lateralMiss) &&
    observerReady

  function describeReport(): string {
    const parts: string[] = []
    if (rangeValue > 0) {
      const side =
        rangeSide === 'short'
          ? ru
            ? 'недолёт'
            : 'short'
          : ru
            ? 'перелёт'
            : 'over'
      parts.push(`${side} ${rangeValue}`)
    }
    if (lateralValue > 0) {
      const side =
        lateralSide === 'left'
          ? ru
            ? 'левее'
            : 'left'
          : ru
            ? 'правее'
            : 'right'
      parts.push(`${side} ${lateralValue}`)
    }
    const text = parts.join(', ')
    return frame === 'observer'
      ? `${text} (${ru ? 'набл.' : 'obs.'} ${observerAzimuth.trim()} ${unitAngle})`
      : text
  }

  function add() {
    if (!canAdd) return

    const local = reportToAdjustment({
      over: rangeSide === 'over' ? rangeValue : -rangeValue,
      right: lateralSide === 'right' ? lateralValue : -lateralValue,
    })

    const adjustment =
      frame === 'observer' && observerMil !== null && gunAzimuthMil !== null
        ? observerToGun(local, observerMil, gunAzimuthMil)
        : local

    onAdd({ ...adjustment, label: describeReport() })
    setRangeMiss('')
    setLateralMiss('')
  }

  function describe(adjustment: Adjustment): string {
    const parts: string[] = []
    if (Math.round(adjustment.range) !== 0) {
      parts.push(
        `${ru ? 'дальность' : 'range'} ${formatSigned(adjustment.range, 0)} ${unitM}`
      )
    }
    if (Math.round(adjustment.lateral) !== 0) {
      const side =
        adjustment.lateral > 0
          ? ru
            ? 'вправо'
            : 'right'
          : ru
            ? 'влево'
            : 'left'
      parts.push(`${side} ${Math.abs(adjustment.lateral).toFixed(0)} ${unitM}`)
    }
    return parts.length > 0 ? parts.join(' · ') : ru ? 'нет' : 'none'
  }

  const hasTotal = history.length > 0

  return (
    <details
      id="adjust-fire"
      open={hasTotal}
      className="rounded-lg border border-app-border bg-app-bg p-4"
    >
      <summary className="cursor-pointer font-semibold text-app-text">
        {ru ? 'Корректировка огня' : 'Adjust fire'}
        {hasTotal && (
          <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
            {describe(total)}
          </span>
        )}
      </summary>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-app-muted">
          {ru ? 'Доклад по линии' : 'Report along'}
        </span>
        <Toggle
          label={ru ? 'Чья линия доклада' : 'Report frame'}
          value={frame}
          onChange={setFrame}
          options={[
            { value: 'gun', label: ru ? 'орудие — цель' : 'gun–target' },
            {
              value: 'observer',
              label: ru ? 'наблюдатель — цель' : 'observer–target',
            },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {frame === 'observer' && (
          <NumberField
            id="adjust-observer"
            className="sm:col-span-2"
            label={
              ru
                ? `Азимут наблюдатель → цель (${unitAngle})`
                : `Observer → target azimuth (${unitAngle})`
            }
            value={observerAzimuth}
            onChange={setObserverAzimuth}
            hint={
              gunAzimuthMil === null
                ? ru
                  ? 'Нужен и азимут орудия на цель — введите его выше.'
                  : 'The gun azimuth to target is also required — enter it above.'
                : ru
                  ? 'Наблюдатель докладывает «левее / правее» так, как видит сам, глядя на цель.'
                  : 'The observer reports left / right as seen while looking at the target.'
            }
          />
        )}

        <NumberField
          id="adjust-range"
          label={ru ? 'По дальности (м)' : 'Range (m)'}
          value={rangeMiss}
          onChange={setRangeMiss}
          onEnter={add}
          aside={
            <Toggle
              label={ru ? 'Недолёт или перелёт' : 'Short or over'}
              value={rangeSide}
              onChange={setRangeSide}
              options={[
                { value: 'short', label: ru ? 'недолёт' : 'short' },
                { value: 'over', label: ru ? 'перелёт' : 'over' },
              ]}
            />
          }
        />
        <NumberField
          id="adjust-lateral"
          label={ru ? 'По направлению (м)' : 'Deflection (m)'}
          value={lateralMiss}
          onChange={setLateralMiss}
          onEnter={add}
          aside={
            <Toggle
              label={ru ? 'Левее или правее' : 'Left or right'}
              value={lateralSide}
              onChange={setLateralSide}
              options={[
                { value: 'left', label: ru ? 'левее' : 'left' },
                { value: 'right', label: ru ? 'правее' : 'right' },
              ]}
            />
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {hasTotal && (
          <>
            <button
              type="button"
              onClick={onUndo}
              className="cursor-pointer rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
            >
              {ru ? 'Отменить последний' : 'Undo last'}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
            >
              {ru ? 'Сбросить' : 'Reset'}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
          className="cursor-pointer rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ru ? 'Учесть разрыв' : 'Apply'}
        </button>
      </div>

      {hasTotal && (
        <div className="mt-4 border-t border-app-border pt-3">
          <p className="text-sm text-app-muted">
            {ru ? 'Итого для орудия' : 'Total for the gun'}:{' '}
            <span className="font-semibold text-app-text">
              {describe(total)}
            </span>
          </p>

          <ol className="mt-2 space-y-1 text-xs text-app-muted">
            {history.map((entry, index) => (
              <li key={index} className="flex flex-wrap justify-between gap-2">
                <span>
                  {index + 1}. {entry.label}
                </span>
                <span className="tabular-nums">→ {describe(entry)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </details>
  )
}

import { FieldIcon } from './FieldIcon'
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
      className="disclosure panel p-4 sm:p-5"
    >
      <summary>
        <span className="inline-flex items-center gap-2 text-app-text">
          <FieldIcon name="correction" className="h-5 w-5 text-app-muted" />
          {ru ? 'Корректировка огня' : 'Adjust fire'}
        </span>
        {hasTotal && (
          <span className="tag tag-accent truncate">{describe(total)}</span>
        )}
      </summary>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="label flex items-center gap-1.5">
          <FieldIcon name="line" />
          {ru ? 'Доклад по линии' : 'Report along'}
        </span>
        <Toggle
          label={ru ? 'Чья линия доклада' : 'Report frame'}
          value={frame}
          onChange={setFrame}
          options={[
            { value: 'gun', label: ru ? 'орудие — цель' : 'gun–target', icon: 'gun' },
            {
              value: 'observer',
              label: ru ? 'наблюдатель — цель' : 'observer–target',
              icon: 'observer',
            },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4">
        {frame === 'observer' && (
          <NumberField
            id="adjust-observer"
            icon="observer"
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
          icon="distance"
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
                { value: 'short', label: ru ? 'недолёт' : 'short', icon: 'arrowDown' },
                { value: 'over', label: ru ? 'перелёт' : 'over', icon: 'arrowUp' },
              ]}
            />
          }
        />
        <NumberField
          id="adjust-lateral"
          icon="correction"
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
                { value: 'left', label: ru ? 'левее' : 'left', icon: 'arrowLeft' },
                { value: 'right', label: ru ? 'правее' : 'right', icon: 'arrowRight' },
              ]}
            />
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {hasTotal && (
          <>
            <button type="button" onClick={onUndo} className="btn">
              <FieldIcon name="undo" />
              {ru ? 'Отменить последний' : 'Undo last'}
            </button>
            <button type="button" onClick={onReset} className="btn btn-danger">
              <FieldIcon name="trash" />
              {ru ? 'Сбросить' : 'Reset'}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
          className="btn btn-primary"
        >
          <FieldIcon name="correction" />
          {ru ? 'Учесть разрыв' : 'Apply'}
          <span className="hidden opacity-70 sm:inline">↵</span>
        </button>
      </div>

      {hasTotal && (
        <div className="mt-4 border-t border-app-border pt-3">
          <p className="text-sm">
            <span className="label">
              {ru ? 'Итого для орудия' : 'Total for the gun'}
            </span>{' '}
            <span className="mono-num ml-1 text-accent">{describe(total)}</span>
          </p>

          <ol className="mt-2 space-y-1 text-[12.5px] text-app-muted">
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

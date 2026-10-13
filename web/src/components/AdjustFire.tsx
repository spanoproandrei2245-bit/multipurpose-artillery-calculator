import { useState } from 'react'

import { formatSigned, isInvalid, parseNumber } from '../lib/input'
import type { Language } from '../types/settings'
import { NumberField, Toggle } from './FormControls'

interface Props {
  // Накопленные поправки, м: дальность (> 0 — дальше),
  // направление (> 0 — правее)
  range: number
  lateral: number
  onAdd: (rangeDelta: number, lateralDelta: number) => void
  onReset: () => void
  language: Language
}

/**
 * Пристрелка по докладу наблюдателя: где лёг разрыв относительно
 * цели. Каждый доклад добавляется к накопленной поправке —
 * следующий разрыв описывается уже относительно новой точки.
 */
export function AdjustFire({
  range,
  lateral,
  onAdd,
  onReset,
  language,
}: Props) {
  const ru = language === 'ru'
  const unitM = ru ? 'м' : 'm'

  const [rangeMiss, setRangeMiss] = useState('')
  const [rangeSide, setRangeSide] = useState<'short' | 'over'>('over')
  const [lateralMiss, setLateralMiss] = useState('')
  const [lateralSide, setLateralSide] = useState<'left' | 'right'>('left')

  const rangeValue = Math.abs(parseNumber(rangeMiss) ?? 0)
  const lateralValue = Math.abs(parseNumber(lateralMiss) ?? 0)
  const canAdd =
    (rangeValue > 0 || lateralValue > 0) &&
    !isInvalid(rangeMiss) &&
    !isInvalid(lateralMiss)

  function add() {
    if (!canAdd) return
    // Недолёт → стрелять дальше; разрыв левее → доворот вправо.
    onAdd(
      rangeSide === 'short' ? rangeValue : -rangeValue,
      lateralSide === 'left' ? lateralValue : -lateralValue
    )
    setRangeMiss('')
    setLateralMiss('')
  }

  function describeTotal() {
    const parts: string[] = []
    if (range !== 0) {
      parts.push(
        `${ru ? 'дальность' : 'range'} ${formatSigned(range, 0)} ${unitM}`
      )
    }
    if (lateral !== 0) {
      const side =
        lateral > 0 ? (ru ? 'вправо' : 'right') : ru ? 'влево' : 'left'
      parts.push(`${side} ${Math.abs(lateral)} ${unitM}`)
    }
    return parts.join(' · ')
  }

  return (
    <details
      open={range !== 0 || lateral !== 0}
      className="rounded-lg border border-app-border bg-app-bg p-4"
    >
      <summary className="cursor-pointer font-semibold text-app-text">
        {ru ? 'Корректировка огня' : 'Adjust fire'}
        {(range !== 0 || lateral !== 0) && (
          <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
            {describeTotal()}
          </span>
        )}
      </summary>
      <p className="mt-3 text-xs text-app-muted">
        {ru
          ? 'Где лёг разрыв относительно цели (по линии орудие — цель). Поправки складываются от разрыва к разрыву.'
          : 'Where the round landed relative to the target (along the gun–target line). Adjustments add up round after round.'}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumberField
          id="adjust-range"
          label={ru ? 'По дальности (м)' : 'Range (m)'}
          value={rangeMiss}
          onChange={setRangeMiss}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-app-muted">
          {ru ? 'Итого' : 'Total'}:{' '}
          <span className="font-semibold text-app-text">
            {range === 0 && lateral === 0
              ? ru
                ? 'нет'
                : 'none'
              : describeTotal()}
          </span>
        </p>

        <div className="flex gap-2">
          {(range !== 0 || lateral !== 0) && (
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
            >
              {ru ? 'Сбросить' : 'Reset'}
            </button>
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
      </div>
    </details>
  )
}

import { t } from '../i18n'
import { useEffect, useState } from 'react'

import { milToDeg } from '../lib/ballistics'
import { gridVector, parseGrid } from '../lib/grid'
import type { AngleUnit } from '../lib/journal'
import { readStoredText, writeStored } from '../lib/input'
import { NumberField } from './FormControls'

interface Props {
  azimuthUnit: AngleUnit
  // Подставить дистанцию и азимут (в единицах azimuthUnit)
  onApply: (distance: number, azimuth: number) => void
}

/**
 * Экспериментально: дистанция и азимут по координатам сетки.
 * Координата орудия запоминается между сессиями.
 */
export function GridInput({ azimuthUnit, onApply }: Props) {

  const [gunGrid, setGunGrid] = useState(() => readStoredText('gunGrid'))
  const [targetGrid, setTargetGrid] = useState('')

  useEffect(() => {
    writeStored('gunGrid', gunGrid)
  }, [gunGrid])

  const gun = parseGrid(gunGrid)
  const target = parseGrid(targetGrid)
  const vector = gun && target ? gridVector(gun, target) : null

  const azimuth =
    vector === null
      ? null
      : azimuthUnit === 'mil'
        ? Math.round(vector.azimuthMil)
        : Math.round(milToDeg(vector.azimuthMil) * 10) / 10

  const distance = vector === null ? null : Math.round(vector.distance)

  function gridHint(value: string) {
    if (value.trim() === '') return null
    return parseGrid(value) === null
      ? t('gridInput.use-6-8-or-10')
      : null
  }

  return (
    <div className="mt-5 rounded-lg bg-app-surface p-4">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-app-text">
          {t('gridInput.from-grid-coordinates')}
        </span>
        <span className="tag tag-warn">
          {t('gridInput.experimental')}
        </span>
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <NumberField
          id="grid-gun"
          icon="grid"
          label={t('gridInput.gun-grid')}
          value={gunGrid}
          onChange={setGunGrid}
          placeholder="034 128"
          inputMode="numeric"
          validate={false}
          hint={gridHint(gunGrid)}
        />
        <NumberField
          id="grid-target"
          icon="grid"
          label={t('gridInput.target-grid')}
          value={targetGrid}
          onChange={setTargetGrid}
          placeholder="041 135"
          inputMode="numeric"
          validate={false}
          hint={gridHint(targetGrid)}
        />
      </div>

      {vector && distance !== null && azimuth !== null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="mono-num text-sm text-app-text">
            {distance} {t('unit.m')} · {azimuth}{' '}
            {azimuthUnit === 'mil' ? (t('unit.mil')) : '°'}
            <span className="ml-2 text-xs text-app-muted">
              ± {vector.precision / 2} {t('unit.m')}
            </span>
          </p>

          <button
            type="button"
            onClick={() => onApply(distance, azimuth)}
            className="btn btn-primary btn-sm"
          >
            {t('gridInput.apply')}
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-app-muted">
        {t('gridInput.heights-are-still-entered-manually')}
      </p>
    </div>
  )
}

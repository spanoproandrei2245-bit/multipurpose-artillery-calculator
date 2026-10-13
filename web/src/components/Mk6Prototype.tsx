
import { useEffect, useState } from 'react'

import mk6 from '../data/artillery/mk6.json'
import { AmmunitionSelector } from './AmmunitionSelector'

import type { Language } from '../types/settings'

interface Props {
  language: Language
}

export function Mk6Prototype({ language }: Props) {
  const ru = language === 'ru'

  const [ammoId, setAmmoId] = useState(
    mk6.ammunition[0]?.id ?? ''
  )

  const [distance, setDistance] = useState('')
  const [ownHeight, setOwnHeight] = useState('')
  const [targetHeight, setTargetHeight] = useState('')

  const [showFullNames, setShowFullNames] = useState(() => {
    return localStorage.getItem('showFullAmmoNames') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem(
      'showFullAmmoNames',
      String(showFullNames)
    )
  }, [showFullNames])

  const selectedAmmo = mk6.ammunition.find(
    (ammo) => ammo.id === ammoId
  )

  const distanceValue = Number(distance)
  const ownHeightValue = Number(ownHeight)
  const targetHeightValue = Number(targetHeight)

  const validDistance =
    distance.trim() !== '' &&
    Number.isFinite(distanceValue) &&
    distanceValue > 0

  const validHeights =
    ownHeight.trim() !== '' &&
    targetHeight.trim() !== '' &&
    Number.isFinite(ownHeightValue) &&
    Number.isFinite(targetHeightValue)

  const heightDifference = validHeights
    ? targetHeightValue - ownHeightValue
    : null

  function resetForm() {
    setDistance('')
    setOwnHeight('')
    setTargetHeight('')
  }

  const inputClass =
    'w-full rounded-lg border border-app-border bg-app-bg px-4 py-3 text-app-text'

  return (
    <section className="mt-6 rounded-xl border border-app-border bg-app-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-app-text">
          Mk6 Prototype
        </h2>

        <span className="text-xs text-app-muted">
          v0.4
        </span>
      </div>

      <div className="mt-6">
        <AmmunitionSelector
          ammunition={mk6.ammunition}
          selectedId={ammoId}
          onSelect={setAmmoId}
          showFullNames={showFullNames}
          onShowFullNamesChange={setShowFullNames}
          language={language}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="mk6-distance"
            className="mb-2 block text-sm text-app-muted"
          >
            {ru ? 'Дистанция (м)' : 'Distance (m)'}
          </label>

          <input
            id="mk6-distance"
            type="number"
            min="0"
            step="any"
            value={distance}
            onChange={(event) =>
              setDistance(event.target.value)
            }
            placeholder="0"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="mk6-own-height"
            className="mb-2 block text-sm text-app-muted"
          >
            {ru ? 'Своя высота (м)' : 'Own height (m)'}
          </label>

          <input
            id="mk6-own-height"
            type="number"
            step="any"
            value={ownHeight}
            onChange={(event) =>
              setOwnHeight(event.target.value)
            }
            placeholder="0"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="mk6-target-height"
            className="mb-2 block text-sm text-app-muted"
          >
            {ru ? 'Высота цели (м)' : 'Target height (m)'}
          </label>

          <input
            id="mk6-target-height"
            type="number"
            step="any"
            value={targetHeight}
            onChange={(event) =>
              setTargetHeight(event.target.value)
            }
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-app-border bg-app-bg p-4">
        <h3 className="font-semibold text-app-text">
          {ru ? 'Результаты ввода' : 'Input results'}
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-app-muted">
              {ru ? 'Дистанция' : 'Distance'}
            </p>
            <p className="text-lg font-semibold text-app-text">
              {validDistance
                ? `${distanceValue} м`
                : '—'}
            </p>
          </div>

          <div>
            <p className="text-sm text-app-muted">
              {ru ? 'Разница высот' : 'Height difference'}
            </p>
            <p className="text-lg font-semibold text-app-text">
              {heightDifference === null
                ? '—'
                : `${heightDifference > 0 ? '+' : ''}${heightDifference} м`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-app-text">
          {ru
            ? 'Зарегистрированные заряды'
            : 'Registered charges'}
        </h3>

        <div className="mt-3 flex flex-wrap gap-2">
          {selectedAmmo?.charges.map((charge) => (
            <span
              key={charge}
              className="rounded-lg border border-app-border bg-app-bg px-4 py-3 text-sm text-app-text"
            >
              Charge {charge}
            </span>
          ))}
        </div>

        <p className="mt-3 text-xs text-app-muted">
          {ru
            ? 'Перечислены заряды из справочника. Пригодность по дистанции не определяется.'
            : 'Charges listed from reference data. Range suitability is not determined.'}
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={resetForm}
          className="cursor-pointer rounded-lg border border-app-border bg-app-bg px-4 py-2 text-sm text-app-text"
        >
          {ru ? 'Очистить поля' : 'Clear inputs'}
        </button>
      </div>
    </section>
  )
}

import { useEffect, useState, type ReactNode } from 'react'

import { artilleryRegistry } from '../data/artillery/registry'
import type { ModelId } from '../data/models'
import {
  degToMil,
  isLargeCorrection,
  lateralCorrectionMil,
  milToDeg,
  MILS_PER_TURN,
  normalizeAngle,
  overallRange,
  profileHasWeather,
  solveAllCharges,
} from '../lib/ballistics'
import {
  formatSigned,
  isInvalid,
  numberToField,
  parseNumber,
  readStored,
  writeStored,
} from '../lib/input'
import type { AngleUnit, JournalDraft, JournalEntry } from '../lib/journal'
import { useWeatherInputs } from '../lib/useWeatherInputs'
import type { ArtilleryMode } from '../types/artillery'
import type { Language } from '../types/settings'
import { AdjustFire } from './AdjustFire'
import { AmmunitionSelector } from './AmmunitionSelector'
import { BallisticTableView } from './BallisticTableView'
import { FireTimer } from './FireTimer'
import { NumberField, Toggle } from './FormControls'
import { GridInput } from './GridInput'
import { WeatherSection } from './WeatherSection'

interface Props {
  modelId: ModelId
  language: Language
  // Запись журнала, из которой восстановлены вводные
  initial?: JournalEntry | null
  // Экспериментальный ввод по координатам сетки (из настроек)
  gridInput?: boolean
  // Выбор модели — в одной строке с выбором боеприпаса
  modelSelector?: ReactNode
  onSave: (draft: JournalDraft) => void
}

export function ArtilleryCalculator({
  modelId,
  language,
  initial = null,
  gridInput = false,
  modelSelector,
  onSave,
}: Props) {
  const ru = language === 'ru'
  const reference = artilleryRegistry[modelId]
  const ammunition = reference.ammunition ?? []

  const [mode, setMode] = useState<ArtilleryMode>(
    reference.availableModes[0]
  )
  const [ammoId, setAmmoId] = useState(
    initial && ammunition.some((a) => a.id === initial.ammoId)
      ? initial.ammoId
      : (ammunition[0]?.id ?? '')
  )
  const [distance, setDistance] = useState(numberToField(initial?.distance))
  const [ownHeight, setOwnHeight] = useState(
    numberToField(initial?.ownHeight)
  )
  const [targetHeight, setTargetHeight] = useState(
    numberToField(initial?.targetHeight)
  )
  const [azimuth, setAzimuth] = useState(numberToField(initial?.azimuth))
  const [azimuthUnit, setAzimuthUnit] = useState<AngleUnit>(
    () =>
      initial?.azimuthUnit ??
      readStored<AngleUnit>('azimuthUnit', ['mil', 'deg'], 'mil')
  )

  // Накопленная корректировка огня, м
  const [rangeAdjust, setRangeAdjust] = useState(
    initial?.rangeCorrection ?? 0
  )
  const [lateralAdjust, setLateralAdjust] = useState(
    initial?.lateralCorrection ?? 0
  )

  const [chosenCharge, setChosenCharge] = useState<number | null>(
    initial?.charge ?? null
  )
  const [saveName, setSaveName] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    writeStored('azimuthUnit', azimuthUnit)
  }, [azimuthUnit])

  const selectedAmmo =
    ammunition.find((ammo) => ammo.id === ammoId) ?? ammunition[0]

  const profile =
    selectedAmmo?.profile !== undefined
      ? reference.profiles?.[selectedAmmo.profile]
      : undefined

  const hasWeather = profile !== undefined && profileHasWeather(profile)

  // ---- ввод ----
  const distanceValue = parseNumber(distance)
  const validDistance = distanceValue !== null && distanceValue > 0

  const own = parseNumber(ownHeight)
  const target = parseNumber(targetHeight)

  const bothHeightsEmpty =
    ownHeight.trim() === '' && targetHeight.trim() === ''
  const bothHeightsValid = own !== null && target !== null

  // Если высоты не введены или введены не полностью, поправка
  // на высоту не применяется (разница = 0).
  const heightDifference = bothHeightsValid ? target - own : 0
  const heightIncomplete = !bothHeightsEmpty && !bothHeightsValid

  // Дистанция с корректировкой; погодная поправка добавляется
  // при расчёте отдельно для каждого заряда.
  const baseRange = validDistance ? distanceValue + rangeAdjust : null

  const azimuthValue = parseNumber(azimuth)
  const azimuthDeg =
    azimuthValue === null
      ? null
      : azimuthUnit === 'mil'
        ? milToDeg(azimuthValue)
        : azimuthValue

  const weatherInputs = useWeatherInputs(
    initial?.weather ?? null,
    hasWeather,
    azimuthDeg
  )

  const invalidInputs = [
    distance,
    azimuth,
    ownHeight,
    targetHeight,
    ...(hasWeather ? weatherInputs.fields : []),
  ].some(isInvalid)

  // ---- расчёт ----
  const results =
    profile && baseRange !== null
      ? solveAllCharges(
          profile,
          mode,
          selectedAmmo?.charges,
          baseRange,
          heightDifference,
          weatherInputs.weather
        )
      : []

  const applicable = results.filter((r) => r.solution !== null)

  const activeResult =
    applicable.find((r) => r.charge === chosenCharge) ?? applicable[0]

  const solution = activeResult?.solution ?? null
  const range = overallRange(results)
  const w = solution?.weather

  // Доворот: боковой ветер + корректировка по направлению, мил.
  const lateralMil =
    validDistance && lateralAdjust !== 0
      ? lateralCorrectionMil(lateralAdjust, distanceValue)
      : 0
  const azimuthCorrectionMil = (w?.azimuth ?? 0) + lateralMil

  // Азимут стрельбы в единицах ввода.
  const firingAzimuth =
    azimuthValue === null || !solution
      ? null
      : azimuthUnit === 'mil'
        ? normalizeAngle(azimuthValue + azimuthCorrectionMil, MILS_PER_TURN)
        : normalizeAngle(azimuthValue + milToDeg(azimuthCorrectionMil), 360)

  function markEdited() {
    setJustSaved(false)
  }

  function edited(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      markEdited()
    }
  }

  function resetForm() {
    setDistance('')
    setOwnHeight('')
    setTargetHeight('')
    setAzimuth('')
    setRangeAdjust(0)
    setLateralAdjust(0)
    setChosenCharge(null)
    setSaveName('')
    markEdited()
  }

  function handleAmmoChange(id: string) {
    setAmmoId(id)
    setChosenCharge(null)
    markEdited()
  }

  function changeAzimuthUnit(unit: AngleUnit) {
    if (unit === azimuthUnit) return
    // Пересчитываем уже введённый азимут в новые единицы.
    if (azimuthValue !== null) {
      const converted =
        unit === 'mil' ? degToMil(azimuthValue) : milToDeg(azimuthValue)
      setAzimuth(String(Math.round(converted * 10) / 10))
    }
    setAzimuthUnit(unit)
    markEdited()
  }

  function handleSave() {
    if (!solution || !activeResult || !selectedAmmo) return
    if (distanceValue === null) return

    const defaultName = `${ru ? 'Цель' : 'Target'} ${distanceValue} ${
      ru ? 'м' : 'm'
    }`

    onSave({
      name: saveName.trim() || defaultName,
      modelId,
      ammoId: selectedAmmo.id,
      charge: activeResult.charge,
      distance: distanceValue,
      ownHeight: bothHeightsValid ? own : null,
      targetHeight: bothHeightsValid ? target : null,
      rangeCorrection: rangeAdjust,
      lateralCorrection: lateralAdjust,
      elevation: solution.elevation,
      tof: solution.tof,
      azimuth: azimuthValue,
      azimuthUnit,
      firingAzimuth,
      weather: weatherInputs.toJournal(),
    })

    setSaveName('')
    setJustSaved(true)
  }

  const unitM = ru ? 'м' : 'm'
  const unitMil = ru ? 'мил' : 'mil'
  const unitS = ru ? 'с' : 's'
  const unitAzimuth = azimuthUnit === 'mil' ? unitMil : '°'

  function formatAzimuth(value: number): string {
    return azimuthUnit === 'mil' ? value.toFixed(0) : value.toFixed(1)
  }

  function describeTurn(mil: number): string {
    const side = mil > 0 ? (ru ? 'вправо' : 'right') : ru ? 'влево' : 'left'
    return `${side} ${Math.abs(mil).toFixed(1)} ${unitMil}`
  }

  const totalRangeCorrection = rangeAdjust + (w?.total ?? 0)

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-4 sm:p-6">
      {/* ---- Модель и боеприпас ---- */}
      <div className="grid items-end gap-4 sm:grid-cols-2">
        {modelSelector}
        <AmmunitionSelector
          ammunition={ammunition}
          selectedId={ammoId}
          onSelect={handleAmmoChange}
          language={language}
        />
      </div>

      {/* Мобильный порядок: цель → результат → корректировка → погода.
          На широком экране результат справа и не уезжает при прокрутке. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* ---- Цель ---- */}
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="calc-distance"
              label={ru ? 'Дистанция (м)' : 'Distance (m)'}
              value={distance}
              onChange={edited(setDistance)}
            />

            <NumberField
              id="calc-azimuth"
              label={ru ? 'Азимут на цель' : 'Azimuth to target'}
              value={azimuth}
              onChange={edited(setAzimuth)}
              placeholder={ru ? 'необязательно' : 'optional'}
              aside={
                <Toggle
                  label={ru ? 'Единицы азимута' : 'Azimuth units'}
                  value={azimuthUnit}
                  onChange={changeAzimuthUnit}
                  options={[
                    { value: 'mil', label: ru ? 'милы' : 'mils' },
                    { value: 'deg', label: ru ? 'градусы' : 'degrees' },
                  ]}
                />
              }
            />

            <NumberField
              id="calc-own-height"
              label={ru ? 'Своя высота (м)' : 'Own height (m)'}
              value={ownHeight}
              onChange={edited(setOwnHeight)}
            />

            <NumberField
              id="calc-target-height"
              label={ru ? 'Высота цели (м)' : 'Target height (m)'}
              value={targetHeight}
              onChange={edited(setTargetHeight)}
            />
          </div>

          <p className="mt-3 text-sm text-app-muted">
            {ru ? 'Разница высот' : 'Height difference'}:{' '}
            <span className="font-semibold text-app-text">
              {formatSigned(heightDifference, 0)} {unitM}
            </span>
            {heightIncomplete && (
              <span className="ml-2">
                {ru
                  ? '— введите обе высоты (поправка пока не применяется)'
                  : '— enter both heights (no correction applied yet)'}
              </span>
            )}
          </p>

          {invalidInputs && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {ru
                ? 'Некоторые значения не распознаны (подсвечены) и не применяются.'
                : 'Some values were not recognised (highlighted) and are not applied.'}
            </p>
          )}

          {gridInput && (
            <GridInput
              azimuthUnit={azimuthUnit}
              language={language}
              onApply={(gridDistance, gridAzimuth) => {
                setDistance(String(gridDistance))
                setAzimuth(String(gridAzimuth))
                markEdited()
              }}
            />
          )}
        </div>

        {/* ---- Результат ---- */}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="rounded-lg border border-app-border bg-app-bg p-4 lg:sticky lg:top-4">
            <h3 className="font-semibold text-app-text">
              {ru ? 'Установки наведения' : 'Firing solution'}
            </h3>

            {!profile && (
              <p className="mt-3 text-sm text-app-muted">
                {ru
                  ? 'Для этого боеприпаса нет таблиц.'
                  : 'No tables for this ammunition.'}
              </p>
            )}

            {profile && !validDistance && (
              <p className="mt-3 text-sm text-app-muted">
                {ru
                  ? 'Введите дистанцию до цели.'
                  : 'Enter the distance to the target.'}
              </p>
            )}

            {profile && validDistance && applicable.length === 0 && range && (
              <p className="mt-3 text-sm text-app-text">
                {rangeAdjust !== 0
                  ? ru
                    ? `Дальность ${baseRange} м (дистанция ${distanceValue} м, корректировка ${formatSigned(rangeAdjust, 0)} м) вне таблиц. Доступно: ${range.min}–${range.max} м.`
                    : `Range ${baseRange} m (distance ${distanceValue} m, adjustment ${formatSigned(rangeAdjust, 0)} m) is outside the tables. Available: ${range.min}–${range.max} m.`
                  : ru
                    ? `Дистанция ${distanceValue} м вне таблиц. Доступно: ${range.min}–${range.max} м.`
                    : `Distance ${distanceValue} m is outside the tables. Available: ${range.min}–${range.max} m.`}
                {weatherInputs.entered &&
                  (ru
                    ? ' С погодной поправкой дальность могла выйти за край таблицы.'
                    : ' The weather correction may have pushed the range past the table edge.')}
              </p>
            )}

            {solution && activeResult && w && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-app-muted">
                      {ru ? 'Возвышение' : 'Elevation'}
                    </p>
                    <p className="text-5xl font-bold tabular-nums text-app-text">
                      {Math.round(solution.elevation)}{' '}
                      <span className="text-base font-normal text-app-muted">
                        {unitMil}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-app-muted">
                      {ru ? 'Азимут' : 'Azimuth'}
                    </p>
                    <p className="text-5xl font-bold tabular-nums text-app-text">
                      {firingAzimuth === null ? (
                        <span className="text-app-muted">—</span>
                      ) : (
                        <>
                          {formatAzimuth(firingAzimuth)}{' '}
                          <span className="text-base font-normal text-app-muted">
                            {unitAzimuth}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-app-muted">
                      {ru ? 'Заряд' : 'Charge'}
                    </p>
                    <p className="text-2xl font-semibold text-app-text">
                      {activeResult.charge}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-app-muted">
                      {ru ? 'Время полёта' : 'Time of flight'}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-app-text">
                      {solution.tof.toFixed(1)}{' '}
                      <span className="text-base font-normal text-app-muted">
                        {unitS}
                      </span>
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-1 text-xs text-app-muted">
                  <li>
                    {ru ? 'По таблице' : 'Table value'}:{' '}
                    {solution.baseElevation.toFixed(1)} {unitMil}
                    {' · '}
                    {ru ? 'высота' : 'height'}{' '}
                    {formatSigned(solution.elevationCorrection)} {unitMil},{' '}
                    {formatSigned(solution.tofCorrection)} {unitS}
                  </li>

                  {totalRangeCorrection !== 0 && (
                    <li>
                      {ru ? 'Дальность по таблице' : 'Table range'}:{' '}
                      {solution.lookupRange.toFixed(0)} {unitM}
                      {rangeAdjust !== 0 &&
                        ` · ${ru ? 'корректировка' : 'adjust'} ${formatSigned(rangeAdjust, 0)} ${unitM}`}
                      {w.wind !== 0 &&
                        ` · ${ru ? 'ветер' : 'wind'} ${formatSigned(w.wind)} ${unitM}`}
                      {w.temperature !== 0 &&
                        ` · ${ru ? 'температура' : 'temperature'} ${formatSigned(w.temperature)} ${unitM}`}
                      {w.density !== 0 &&
                        ` · ${ru ? 'плотность' : 'density'} ${formatSigned(w.density)} ${unitM}`}
                    </li>
                  )}

                  {azimuthCorrectionMil !== 0 && (
                    <li>
                      {ru ? 'Доворот' : 'Turn'}:{' '}
                      {describeTurn(azimuthCorrectionMil)}
                      {w.azimuth !== 0 &&
                        lateralMil !== 0 &&
                        ` (${ru ? 'ветер' : 'wind'} ${formatSigned(w.azimuth)}, ${ru ? 'корректировка' : 'adjust'} ${formatSigned(lateralMil)})`}
                      {azimuthValue === null &&
                        (ru
                          ? ' — введите азимут, чтобы получить готовое значение'
                          : ' — enter the azimuth to get the final value')}
                    </li>
                  )}
                </ul>

                {w.missing && (
                  <p className="mt-2 text-xs text-app-text">
                    {ru
                      ? 'На этой дальности в таблице нет части погодных поправок (прочерк «-»). Они не применены.'
                      : 'The table lacks some weather corrections at this range ("-"). They are not applied.'}
                  </p>
                )}

                {solution.heightCorrectionMissing && (
                  <p className="mt-2 text-xs text-app-text">
                    {ru
                      ? 'На этой дальности в таблице игры нет поправки на высоту (прочерк «-»). Результат дан без неё.'
                      : 'The game table has no height correction at this range ("-"). The result is shown without it.'}
                  </p>
                )}

                {isLargeCorrection(solution) && (
                  <p className="mt-2 text-xs text-app-text">
                    {ru
                      ? 'Большая разница высот: поправка линейная, точность снижена.'
                      : 'Large height difference: the correction is linear, accuracy is reduced.'}
                  </p>
                )}

                <FireTimer tof={solution.tof} language={language} />

                {/* ---- Сохранение в журнал ---- */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(event) => setSaveName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleSave()
                    }}
                    maxLength={60}
                    aria-label={ru ? 'Название метки' : 'Mark name'}
                    placeholder={
                      ru ? 'Название метки' : 'Mark name'
                    }
                    className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text outline-none focus:border-emerald-500"
                  />

                  <button
                    type="button"
                    onClick={handleSave}
                    className="cursor-pointer rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    {justSaved
                      ? ru
                        ? 'Сохранено ✓'
                        : 'Saved ✓'
                      : ru
                        ? 'В журнал'
                        : 'Save'}
                  </button>
                </div>
              </>
            )}

            {/* ---- Выбор заряда ---- */}
            {results.length > 0 && (
              <div className="mt-5 border-t border-app-border pt-4">
                <h4 className="text-sm font-semibold text-app-text">
                  {ru ? 'Заряды' : 'Charges'}
                </h4>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {results.map((result) => {
                    const usable = result.solution !== null
                    const active =
                      usable && result.charge === activeResult?.charge

                    return (
                      <button
                        key={result.charge}
                        type="button"
                        disabled={!usable}
                        aria-pressed={active}
                        onClick={() => {
                          setChosenCharge(result.charge)
                          markEdited()
                        }}
                        className={[
                          'rounded-lg border px-3 py-2 text-left text-sm',
                          active
                            ? 'border-emerald-500 bg-app-surface text-app-text'
                            : 'border-app-border bg-app-bg text-app-text',
                          usable
                            ? 'cursor-pointer'
                            : 'cursor-not-allowed opacity-50',
                        ].join(' ')}
                      >
                        <span className="block font-semibold">
                          {ru ? 'Заряд' : 'Charge'} {result.charge}
                        </span>

                        <span className="block text-xs text-app-muted">
                          {result.solution
                            ? `${Math.round(result.solution.elevation)} ${unitMil} · ${result.solution.tof.toFixed(1)} ${unitS}`
                            : `${result.minRange}–${result.maxRange} ${unitM}`}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <p className="mt-2 text-xs text-app-muted">
                  {ru
                    ? 'По умолчанию — наименьший подходящий заряд. Между строками таблицы — линейная интерполяция.'
                    : 'The lowest suitable charge by default. Linear interpolation between table rows.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ---- Корректировка и погода ---- */}
        <div className="lg:col-start-1 lg:row-start-2">
          <AdjustFire
            range={rangeAdjust}
            lateral={lateralAdjust}
            onAdd={(rangeDelta, lateralDelta) => {
              setRangeAdjust((value) => value + rangeDelta)
              setLateralAdjust((value) => value + lateralDelta)
              markEdited()
            }}
            onReset={() => {
              setRangeAdjust(0)
              setLateralAdjust(0)
              markEdited()
            }}
            language={language}
          />

          {hasWeather ? (
            <WeatherSection
              inputs={weatherInputs}
              defaultOpen={(initial?.weather ?? null) !== null}
              language={language}
              onEdit={markEdited}
            />
          ) : (
            profile && (
              <p className="mt-4 text-xs text-app-muted">
                {ru
                  ? 'Погодные поправки недоступны: в таблицах этой модели погодные столбцы пустые («-»).'
                  : 'Weather corrections are unavailable: the weather columns of this model’s tables are empty ("-").'}
              </p>
            )
          )}
        </div>
      </div>

      {profile && (
        <BallisticTableView
          profile={profile}
          mode={mode}
          onModeChange={(value) => {
            setMode(value)
            setChosenCharge(null)
            markEdited()
          }}
          charges={selectedAmmo?.charges}
          activeCharge={activeResult?.charge ?? null}
          highlightRange={solution?.lookupRange ?? null}
          language={language}
        />
      )}

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

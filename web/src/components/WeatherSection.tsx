import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'
import { STANDARD_TEMPERATURE } from '../lib/ballistics'
import { formatSigned } from '../lib/input'
import type { WeatherInputs } from '../lib/useWeatherInputs'
import { NumberField, Toggle } from './FormControls'

interface Props {
  inputs: WeatherInputs
  // Погода сохранена в загруженной записи — раскрыть сразу
  defaultOpen: boolean
  // Любое изменение сбрасывает отметку «Сохранено»
  onEdit: () => void
}

export function WeatherSection({
  inputs: w,
  defaultOpen,
  onEdit,
}: Props) {
  const mps = t('unit.mps')

  // Краткая сводка для свёрнутого заголовка
  function summary(): string {
    const parts: string[] = []
    if (w.windMode === 'vector') {
      if (w.windSpeed.trim() !== '') {
        parts.push(
          `${t('artilleryCalculator.wind')} ${w.windSpeed} ${mps}` +
            (w.windFrom.trim() !== '' ? ` ${t('weatherSection.from')} ${w.windFrom}°` : '')
        )
      }
    } else {
      if (w.headwind.trim() !== '') {
        const head = w.headSide === 'head' ? (t('weatherSection.head')) : t('weatherSection.tail')
        parts.push(`${head} ${w.headwind} ${mps}`)
      }
      if (w.crosswind.trim() !== '') {
        const side = w.crossSide === 'left' ? (t('weatherSection.left')) : t('weatherSection.right')
        parts.push(`${t('weatherSection.cross')} ${side} ${w.crosswind} ${mps}`)
      }
    }
    if (w.temperature.trim() !== '') parts.push(`${w.temperature} °C`)
    if (w.pressure.trim() !== '') parts.push(`${w.pressure} ${t('unit.hpa')}`)
    return parts.join(' · ')
  }

  function edited<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      onEdit()
    }
  }

  return (
    <details
      open={defaultOpen}
      className="disclosure panel p-4 sm:p-5"
    >
      <summary>
        <span className="inline-flex items-center gap-2 text-app-text">
          <FieldIcon name="weather" className="h-5 w-5 text-app-muted" />
          {t('weatherSection.weather-corrections')}
        </span>
        {w.entered && (
          <span className="tag tag-accent truncate">{summary()}</span>
        )}
      </summary>

      <p className="mt-4 text-xs text-app-muted">
        {t('weatherSection.only-needed-when-advanced-corrections')}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="label">{t('weatherSection.wind')}</span>
        <Toggle
          label={t('weatherSection.wind-input')}
          value={w.windMode}
          onChange={edited(w.setWindMode)}
          options={[
            {
              value: 'vector',
              label: t('weatherSection.speed-direction'),
            },
            {
              value: 'components',
              label: t('weatherSection.head-cross'),
            },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {w.windMode === 'vector' ? (
          <>
            <NumberField
              id="calc-wind-speed"
              icon="wind"
              label={t('weatherSection.wind-speed-m-s')}
              value={w.windSpeed}
              onChange={edited(w.setWindSpeed)}
            />
            <NumberField
              id="calc-wind-from"
              icon="windDirection"
              label={
                t('weatherSection.wind-from-0-from-north')
              }
              value={w.windFrom}
              onChange={edited(w.setWindFrom)}
            />
          </>
        ) : (
          <>
            <NumberField
              id="calc-headwind"
              icon="wind"
              label={`HEADWIND (${mps})`}
              value={w.headwind}
              onChange={edited(w.setHeadwind)}
              aside={
                <Toggle
                  label={t('weatherSection.head-or-tail')}
                  value={w.headSide}
                  onChange={edited(w.setHeadSide)}
                  options={[
                    { value: 'head', label: t('weatherSection.head-2') },
                    { value: 'tail', label: t('weatherSection.tail-2') },
                  ]}
                />
              }
            />
            <NumberField
              id="calc-crosswind"
              icon="wind"
              label={`CROSSWIND (${mps})`}
              value={w.crosswind}
              onChange={edited(w.setCrosswind)}
              aside={
                <Toggle
                  label={t('weatherSection.crosswind-from')}
                  value={w.crossSide}
                  onChange={edited(w.setCrossSide)}
                  options={[
                    { value: 'left', label: t('weatherSection.left-2') },
                    { value: 'right', label: t('weatherSection.right-2') },
                  ]}
                />
              }
            />
            <p className="text-xs text-app-muted sm:col-span-2">
              {t('weatherSection.facing-the-target-a-minus')}
            </p>
          </>
        )}

        <NumberField
          id="calc-temperature"
          icon="temperature"
          label={
            t('weatherSection.air-temperature-c-standard', STANDARD_TEMPERATURE)
          }
          value={w.temperature}
          onChange={edited(w.setTemperature)}
        />
        <NumberField
          id="calc-pressure"
          icon="pressure"
          label={
            t('weatherSection.pressure-hpa-standard-1013')
          }
          value={w.pressure}
          onChange={edited(w.setPressure)}
        />
      </div>

      <div className="mt-3 space-y-1 text-[12.5px] text-app-muted">
        {w.windMode === 'vector' && w.windIncomplete && (
          <p className="rounded-md bg-app-raised px-3 py-2 font-sans text-xs text-warn">
            {t('weatherSection.enter-the-wind-direction-and')}
          </p>
        )}

        {w.windMode === 'vector' &&
          !w.windIncomplete &&
          (w.wind.headwind !== 0 || w.wind.crosswind !== 0) && (
            <p>
              {t('weatherSection.headwind')} {formatSigned(w.wind.headwind)}{' '}
              {mps}
              {' · '}
              {t('weatherSection.crosswind')}{' '}
              {formatSigned(w.wind.crosswind)} {mps}
            </p>
          )}

        {w.densityValue !== null && (
          <p>
            {t('weatherSection.air-density')}:{' '}
            {w.densityValue.toFixed(1)} %
            {w.temperatureValue === null &&
              (t('weatherSection.at-c', STANDARD_TEMPERATURE))}
          </p>
        )}
      </div>

      {w.entered && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              w.reset()
              onEdit()
            }}
            className="btn btn-sm btn-danger"
          >
            {t('weatherSection.reset-weather')}
          </button>
        </div>
      )}
    </details>
  )
}

import { STANDARD_TEMPERATURE } from '../lib/ballistics'
import { formatSigned } from '../lib/input'
import type { WeatherInputs } from '../lib/useWeatherInputs'
import type { Language } from '../types/settings'
import { NumberField, Toggle } from './FormControls'

interface Props {
  inputs: WeatherInputs
  // Погода сохранена в загруженной записи — раскрыть сразу
  defaultOpen: boolean
  language: Language
  // Любое изменение сбрасывает отметку «Сохранено»
  onEdit: () => void
}

export function WeatherSection({
  inputs: w,
  defaultOpen,
  language,
  onEdit,
}: Props) {
  const ru = language === 'ru'
  const mps = ru ? 'м/с' : 'm/s'

  // Краткая сводка для свёрнутого заголовка
  function summary(): string {
    const parts: string[] = []
    if (w.windMode === 'vector') {
      if (w.windSpeed.trim() !== '') {
        parts.push(
          `${ru ? 'ветер' : 'wind'} ${w.windSpeed} ${mps}` +
            (w.windFrom.trim() !== '' ? ` ${ru ? 'с' : 'from'} ${w.windFrom}°` : '')
        )
      }
    } else {
      if (w.headwind.trim() !== '') {
        const head = w.headSide === 'head' ? (ru ? 'встр.' : 'head') : ru ? 'попут.' : 'tail'
        parts.push(`${head} ${w.headwind} ${mps}`)
      }
      if (w.crosswind.trim() !== '') {
        const side = w.crossSide === 'left' ? (ru ? 'слева' : 'left') : ru ? 'справа' : 'right'
        parts.push(`${ru ? 'бок.' : 'cross'} ${side} ${w.crosswind} ${mps}`)
      }
    }
    if (w.temperature.trim() !== '') parts.push(`${w.temperature} °C`)
    if (w.pressure.trim() !== '') parts.push(`${w.pressure} ${ru ? 'гПа' : 'hPa'}`)
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
      className="disclosure panel ticks p-4 sm:p-5"
    >
      <summary>
        <span className="index">[05]</span>
        <span className="label text-app-text">
          {ru ? 'Погодные поправки' : 'Weather corrections'}
        </span>
        {w.entered && (
          <span className="tag tag-accent truncate">{summary()}</span>
        )}
      </summary>

      <p className="mt-4 text-xs text-app-muted">
        {ru
          ? 'Нужны, только если на сервере включены продвинутые поправки (advanced corrections). Пустое поле — стандартные условия. Данные — с Kestrel 4500.'
          : 'Only needed when advanced corrections are enabled on the server. An empty field means standard conditions. Read the values from the Kestrel 4500.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="label">{ru ? 'Ветер' : 'Wind'}</span>
        <Toggle
          label={ru ? 'Способ ввода ветра' : 'Wind input'}
          value={w.windMode}
          onChange={edited(w.setWindMode)}
          options={[
            {
              value: 'vector',
              label: ru ? 'Скорость и направление' : 'Speed & direction',
            },
            {
              value: 'components',
              label: ru ? 'Встречный / боковой' : 'Head / cross',
            },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {w.windMode === 'vector' ? (
          <>
            <NumberField
              id="calc-wind-speed"
              label={ru ? 'Скорость ветра (м/с)' : 'Wind speed (m/s)'}
              value={w.windSpeed}
              onChange={edited(w.setWindSpeed)}
            />
            <NumberField
              id="calc-wind-from"
              label={
                ru
                  ? 'Откуда дует (°, 0 = с севера)'
                  : 'Wind from (°, 0 = from north)'
              }
              value={w.windFrom}
              onChange={edited(w.setWindFrom)}
            />
          </>
        ) : (
          <>
            <NumberField
              id="calc-headwind"
              label={`HEADWIND (${mps})`}
              value={w.headwind}
              onChange={edited(w.setHeadwind)}
              aside={
                <Toggle
                  label={ru ? 'Встречный или попутный' : 'Head or tail'}
                  value={w.headSide}
                  onChange={edited(w.setHeadSide)}
                  options={[
                    { value: 'head', label: ru ? 'встречный' : 'head' },
                    { value: 'tail', label: ru ? 'попутный' : 'tail' },
                  ]}
                />
              }
            />
            <NumberField
              id="calc-crosswind"
              label={`CROSSWIND (${mps})`}
              value={w.crosswind}
              onChange={edited(w.setCrosswind)}
              aside={
                <Toggle
                  label={ru ? 'Откуда боковой ветер' : 'Crosswind from'}
                  value={w.crossSide}
                  onChange={edited(w.setCrossSide)}
                  options={[
                    { value: 'left', label: ru ? '← слева' : '← left' },
                    { value: 'right', label: ru ? 'справа →' : 'right →' },
                  ]}
                />
              }
            />
            <p className="text-xs text-app-muted sm:col-span-2">
              {ru
                ? 'Стоя лицом к цели. Минус на экране HEADWIND — попутный ветер. Сторону бокового ветра Kestrel не показывает — смотрите стрелку ветра ACE или дым.'
                : 'Facing the target. A minus on the HEADWIND screen means tailwind. The Kestrel does not show the crosswind side — use the ACE wind arrow or smoke.'}
            </p>
          </>
        )}

        <NumberField
          id="calc-temperature"
          label={
            ru
              ? `Температура воздуха (°C, стандарт ${STANDARD_TEMPERATURE})`
              : `Air temperature (°C, standard ${STANDARD_TEMPERATURE})`
          }
          value={w.temperature}
          onChange={edited(w.setTemperature)}
        />
        <NumberField
          id="calc-pressure"
          label={
            ru ? 'Давление (гПа, стандарт 1013)' : 'Pressure (hPa, standard 1013)'
          }
          value={w.pressure}
          onChange={edited(w.setPressure)}
        />
      </div>

      <div className="mt-3 space-y-1 font-mono text-[11px] text-app-muted">
        {w.windMode === 'vector' && w.windIncomplete && (
          <p className="border-l-2 border-warn pl-2 font-sans text-xs text-warn">
            {ru
              ? 'Для ветра укажите направление и азимут на цель — пока ветер не учитывается.'
              : 'Enter the wind direction and the azimuth to target — wind is not applied yet.'}
          </p>
        )}

        {w.windMode === 'vector' &&
          !w.windIncomplete &&
          (w.wind.headwind !== 0 || w.wind.crosswind !== 0) && (
            <p>
              {ru ? 'Встречный' : 'Headwind'} {formatSigned(w.wind.headwind)}{' '}
              {mps}
              {' · '}
              {ru ? 'боковой' : 'crosswind'}{' '}
              {formatSigned(w.wind.crosswind)} {mps}
            </p>
          )}

        {w.densityValue !== null && (
          <p>
            {ru ? 'Плотность воздуха' : 'Air density'}:{' '}
            {w.densityValue.toFixed(1)} %
            {w.temperatureValue === null &&
              (ru
                ? ` (при ${STANDARD_TEMPERATURE} °C)`
                : ` (at ${STANDARD_TEMPERATURE} °C)`)}
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
            {ru ? 'Сбросить погоду' : 'Reset weather'}
          </button>
        </div>
      )}
    </details>
  )
}

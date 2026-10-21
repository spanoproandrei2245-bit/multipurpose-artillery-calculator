import { t } from '../i18n'
import { STANDARD_TEMPERATURE } from '../lib/ballistics'
import { formatSigned } from '../lib/input'
import type { WeatherInputs } from '../lib/useWeatherInputs'
import { InlineNumber, Row, Toggle } from './FormControls'

interface Props {
  inputs: WeatherInputs
  // Любое изменение сбрасывает отметку «Сохранено»
  onEdit: () => void
}

/**
 * Погодные поправки прямо в основной таблице вводных (под высотой орудия):
 * ветер (скорость и откуда или встречный и боковой), температура, давление.
 * Показываются, когда раздел включён в настройках.
 */
export function WeatherRows({ inputs: w, onEdit }: Props) {
  const mps = t('unit.mps')

  function edited<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      onEdit()
    }
  }

  const note = 'px-1 text-[12.5px] text-app-muted'

  return (
    <>
      <Row icon="wind" control="full" label={t('weatherSection.wind')}>
        <Toggle
          label={t('weatherSection.wind-input')}
          className="min-w-0 flex-1 [&>button]:flex-auto [&>button]:justify-center [&>button]:px-1.5 [&>button]:text-[12.5px]"
          value={w.windMode}
          onChange={edited(w.setWindMode)}
          options={[
            {
              value: 'vector',
              label: t('weatherSection.mode-speed'),
              title: t('weatherSection.speed-direction'),
            },
            {
              value: 'components',
              label: t('weatherSection.mode-components'),
              title: t('weatherSection.head-cross'),
            },
          ]}
        />
      </Row>

      {w.windMode === 'vector' ? (
        <>
          <Row
            icon="wind"
            control="unit"
            unit={mps}
            label={t('weatherSection.wind-speed-label')}
            htmlFor="calc-wind-speed"
          >
            <InlineNumber
              id="calc-wind-speed"
              value={w.windSpeed}
              onChange={edited(w.setWindSpeed)}
              block
            />
          </Row>
          <Row
            icon="windDirection"
            control="unit"
            unit="°"
            label={t('weatherSection.wind-from-label')}
            htmlFor="calc-wind-from"
          >
            <InlineNumber
              id="calc-wind-from"
              value={w.windFrom}
              onChange={edited(w.setWindFrom)}
              placeholder="0 = N"
              block
            />
          </Row>
        </>
      ) : (
        <>
          <Row
            icon="wind"
            control="unit"
            unit={mps}
            label={t('weatherSection.along-label')}
            htmlFor="calc-headwind"
          >
            <Toggle
              label={t('weatherSection.head-or-tail')}
              className="[&>button]:px-1.5 [&>button]:text-[12.5px]"
              value={w.headSide}
              onChange={edited(w.setHeadSide)}
              options={[
                { value: 'head', label: t('weatherSection.head') },
                { value: 'tail', label: t('weatherSection.tail') },
              ]}
            />
            <InlineNumber
              id="calc-headwind"
              value={w.headwind}
              onChange={edited(w.setHeadwind)}
              block
            />
          </Row>
          <Row
            icon="wind"
            control="unit"
            unit={mps}
            label={t('weatherSection.cross-label')}
            htmlFor="calc-crosswind"
          >
            <Toggle
              label={t('weatherSection.crosswind-from')}
              className="[&>button]:px-1.5 [&>button]:text-[12.5px]"
              value={w.crossSide}
              onChange={edited(w.setCrossSide)}
              options={[
                { value: 'left', label: t('weatherSection.left') },
                { value: 'right', label: t('weatherSection.right') },
              ]}
            />
            <InlineNumber
              id="calc-crosswind"
              value={w.crosswind}
              onChange={edited(w.setCrosswind)}
              block
            />
          </Row>
        </>
      )}

      <Row
        icon="temperature"
        control="unit"
        unit="°C"
        label={t('weatherSection.temperature-label')}
        htmlFor="calc-temperature"
      >
        <InlineNumber
          id="calc-temperature"
          value={w.temperature}
          onChange={edited(w.setTemperature)}
          placeholder={String(STANDARD_TEMPERATURE)}
          block
        />
      </Row>
      <Row
        icon="pressure"
        control="unit"
        unit={t('unit.hpa')}
        label={t('weatherSection.pressure-label')}
        htmlFor="calc-pressure"
      >
        <InlineNumber
          id="calc-pressure"
          value={w.pressure}
          onChange={edited(w.setPressure)}
          placeholder="1013"
          block
        />
      </Row>

      {/* Пояснения и сброс — под строками, мелко */}
      <div className="space-y-1 pt-1 pb-2">
        {w.windMode === 'vector' && w.windIncomplete && (
          <p className={`${note} text-warn`}>
            {t('weatherSection.enter-the-wind-direction-and')}
          </p>
        )}
        {w.windMode === 'vector' &&
          !w.windIncomplete &&
          (w.wind.headwind !== 0 || w.wind.crosswind !== 0) && (
            <p className={note}>
              {t('weatherSection.headwind')} {formatSigned(w.wind.headwind)} {mps}
              {' · '}
              {t('weatherSection.crosswind')} {formatSigned(w.wind.crosswind)} {mps}
            </p>
          )}
        {w.windMode === 'components' && (
          <p className={note}>{t('weatherSection.facing-the-target-a-minus')}</p>
        )}
        {w.densityValue !== null && (
          <p className={note}>
            {t('weatherSection.air-density')}: {w.densityValue.toFixed(1)} %
            {w.temperatureValue === null &&
              t('weatherSection.at-c', STANDARD_TEMPERATURE)}
          </p>
        )}
        {w.entered && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                w.reset()
                onEdit()
              }}
              className="btn btn-sm btn-ghost btn-danger"
            >
              {t('weatherSection.reset-weather')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

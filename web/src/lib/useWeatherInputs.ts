import { useEffect, useState } from 'react'

import {
  airDensityPercent,
  NO_WEATHER,
  STANDARD_TEMPERATURE,
  windComponents,
  type Weather,
} from './ballistics'
import {
  numberToField,
  parseNumber,
  readStored,
  writeStored,
} from './input'
import type { JournalWeather, WindMode } from './journal'

function abs(value: number | null | undefined) {
  return value === null || value === undefined ? value : Math.abs(value)
}

/** Модуль скорости ветра со знаком выбранного направления. */
function signedWind(value: number | null, positive: boolean): number | null {
  if (value === null) return null
  return positive ? Math.abs(value) : -Math.abs(value)
}

/**
 * Состояние полей погоды и пересчёт их в условия для баллистики.
 *
 * azimuthDeg нужен для режима «скорость и направление»: ветер
 * раскладывается на встречную и боковую составляющие относительно
 * линии огня.
 */
export function useWeatherInputs(
  saved: JournalWeather | null,
  enabled: boolean,
  azimuthDeg: number | null
) {
  const [windMode, setWindMode] = useState<WindMode>(
    () =>
      saved?.windMode ??
      readStored<WindMode>('windMode', ['vector', 'components'], 'vector')
  )
  const [windSpeed, setWindSpeed] = useState(numberToField(saved?.windSpeed))
  const [windFrom, setWindFrom] = useState(numberToField(saved?.windFrom))

  // Kestrel показывает величину ветра без знака, поэтому
  // направление выбирается отдельной кнопкой, а в поле — модуль.
  const [headwind, setHeadwind] = useState(
    numberToField(abs(saved?.headwind))
  )
  const [headSide, setHeadSide] = useState<'head' | 'tail'>(
    (saved?.headwind ?? 0) < 0 ? 'tail' : 'head'
  )
  const [crosswind, setCrosswind] = useState(
    numberToField(abs(saved?.crosswind))
  )
  const [crossSide, setCrossSide] = useState<'right' | 'left'>(
    (saved?.crosswind ?? 0) < 0 ? 'left' : 'right'
  )

  const [temperature, setTemperature] = useState(
    numberToField(saved?.temperature)
  )
  const [pressure, setPressure] = useState(numberToField(saved?.pressure))

  useEffect(() => {
    writeStored('windMode', windMode)
  }, [windMode])

  const temperatureValue = parseNumber(temperature)
  const pressureValue = parseNumber(pressure)
  const densityValue =
    pressureValue !== null && pressureValue > 0
      ? airDensityPercent(
          temperatureValue ?? STANDARD_TEMPERATURE,
          pressureValue
        )
      : null

  const windSpeedValue = parseNumber(windSpeed)
  const windFromValue = parseNumber(windFrom)
  const headwindValue = signedWind(parseNumber(headwind), headSide === 'head')
  const crosswindValue = signedWind(
    parseNumber(crosswind),
    crossSide === 'right'
  )

  let wind = { headwind: 0, crosswind: 0 }
  let windIncomplete = false

  if (windMode === 'vector') {
    if (windSpeedValue !== null && windSpeedValue !== 0) {
      if (windFromValue !== null && azimuthDeg !== null) {
        wind = windComponents(windSpeedValue, windFromValue, azimuthDeg)
      } else {
        windIncomplete = true
      }
    }
  } else {
    wind = {
      headwind: headwindValue ?? 0,
      crosswind: crosswindValue ?? 0,
    }
  }

  const weather: Weather = enabled
    ? { ...wind, temperature: temperatureValue, density: densityValue }
    : NO_WEATHER

  const fields =
    windMode === 'vector'
      ? [windSpeed, windFrom, temperature, pressure]
      : [headwind, crosswind, temperature, pressure]
  const entered = fields.some((v) => v.trim() !== '')

  function reset() {
    setWindSpeed('')
    setWindFrom('')
    setHeadwind('')
    setCrosswind('')
    setTemperature('')
    setPressure('')
  }

  function toJournal(): JournalWeather | null {
    if (!enabled || !entered) return null
    return {
      windMode,
      windSpeed: windSpeedValue,
      windFrom: windFromValue,
      headwind: headwindValue,
      crosswind: crosswindValue,
      temperature: temperatureValue,
      pressure: pressureValue,
    }
  }

  return {
    windMode,
    setWindMode,
    windSpeed,
    setWindSpeed,
    windFrom,
    setWindFrom,
    headwind,
    setHeadwind,
    headSide,
    setHeadSide,
    crosswind,
    setCrosswind,
    crossSide,
    setCrossSide,
    temperature,
    setTemperature,
    pressure,
    setPressure,

    wind,
    windIncomplete,
    temperatureValue,
    densityValue,
    weather,
    fields,
    entered,
    reset,
    toJournal,
  }
}

export type WeatherInputs = ReturnType<typeof useWeatherInputs>

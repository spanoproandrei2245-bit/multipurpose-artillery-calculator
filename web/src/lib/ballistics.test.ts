import { describe, expect, it } from 'vitest'

import type {
  BallisticProfile,
  BallisticRow,
} from '../types/artillery'
import {
  airDensityPercent,
  degToMil,
  interpolateRow,
  isLargeCorrection,
  isNearTableEdge,
  metersPerMil,
  pickCharge,
  lateralCorrectionMil,
  milToDeg,
  NO_WEATHER,
  normalizeAngle,
  overallRange,
  profileHasWeather,
  solve,
  solveAllCharges,
  weatherCorrection,
  windComponents,
  type Weather,
} from './ballistics'

// Две строки из таблицы M252, заряд 4 (HIGH), со всеми 12 столбцами.
const WEATHER_ROWS: BallisticRow[] = [
  [2000, 1241, 6.3, 0.7, 35.1, 3.1, 8.4, -7.9, 0.2, -0.3, -4.7, 4.4],
  [2050, 1230, 6.5, 0.7, 34.9, 3.0, 8.4, -7.8, 0.3, -0.3, -4.9, 4.7],
  [2100, 1219, 7.0, 0.7, 34.8, 2.9, 8.5, -8.0, 0.2, -0.4, -5.0, 4.7],
]

// Таблица без погодных столбцов, с прочерком в первой строке.
const BASE_ROWS: BallisticRow[] = [
  [50, 1548, null, null, 14.2],
  [100, 1495, 9.1, 1.4, 14.1],
  [150, 1441, 14.4, 1.4, 14.0],
]

function weather(partial: Partial<Weather>): Weather {
  return { ...NO_WEATHER, ...partial }
}

describe('interpolateRow', () => {
  it('returns the exact row on a table range', () => {
    const values = interpolateRow(WEATHER_ROWS, 2050)
    expect(values?.elevation).toBe(1230)
    expect(values?.tof).toBe(34.9)
    expect(values?.weather?.rangePerHeadwind).toBe(8.4)
  })

  it('interpolates linearly between rows', () => {
    const values = interpolateRow(WEATHER_ROWS, 2025)
    expect(values?.elevation).toBeCloseTo(1235.5)
    expect(values?.dElevPer100m).toBeCloseTo(6.4)
    expect(values?.weather?.azimuthPerCrosswind).toBeCloseTo(3.05)
  })

  it('does not extrapolate outside the table', () => {
    expect(interpolateRow(WEATHER_ROWS, 1999)).toBeNull()
    expect(interpolateRow(WEATHER_ROWS, 2101)).toBeNull()
    expect(interpolateRow(WEATHER_ROWS, Number.NaN)).toBeNull()
    expect(interpolateRow([], 100)).toBeNull()
  })

  it('accepts the first and last rows', () => {
    expect(interpolateRow(WEATHER_ROWS, 2000)?.elevation).toBe(1241)
    expect(interpolateRow(WEATHER_ROWS, 2100)?.elevation).toBe(1219)
  })

  it('propagates a dash between rows but keeps it exact on its row', () => {
    expect(interpolateRow(BASE_ROWS, 50)?.dElevPer100m).toBeNull()
    expect(interpolateRow(BASE_ROWS, 75)?.dElevPer100m).toBeNull()
    expect(interpolateRow(BASE_ROWS, 75)?.elevation).toBeCloseTo(1521.5)
  })

  it('has no weather coefficients for 5-column tables', () => {
    expect(interpolateRow(BASE_ROWS, 100)?.weather).toBeNull()
  })
})

describe('solve: height difference', () => {
  it('lowers elevation when the target is higher (ACE rule)', () => {
    const solution = solve(WEATHER_ROWS, 2000, 100)
    expect(solution?.elevation).toBeCloseTo(1241 - 6.3)
    expect(solution?.tof).toBeCloseTo(35.1 - 0.7)
  })

  it('raises elevation when the target is lower', () => {
    const solution = solve(WEATHER_ROWS, 2000, -50)
    expect(solution?.elevation).toBeCloseTo(1241 + 3.15)
  })

  it('flags a missing height correction on dash rows', () => {
    const solution = solve(BASE_ROWS, 50, 20)
    expect(solution?.heightCorrectionMissing).toBe(true)
    expect(solution?.elevation).toBe(1548)
  })

  it('does not flag a dash when there is no height difference', () => {
    expect(solve(BASE_ROWS, 50, 0)?.heightCorrectionMissing).toBe(false)
  })

  it('marks large corrections as low accuracy', () => {
    const big = solve(BASE_ROWS, 150, 400)
    expect(big && isLargeCorrection(big)).toBe(true)
    const small = solve(BASE_ROWS, 150, 10)
    expect(small && isLargeCorrection(small)).toBe(false)
  })
})

describe('weatherCorrection', () => {
  const at2000 = interpolateRow(WEATHER_ROWS, 2000)!.weather

  it('headwind adds range (HEAD column)', () => {
    const result = weatherCorrection(at2000, weather({ headwind: 5 }))
    expect(result.wind).toBeCloseTo(42)
    expect(result.total).toBeCloseTo(42)
  })

  it('tailwind subtracts range (TAIL column)', () => {
    const result = weatherCorrection(at2000, weather({ headwind: -5 }))
    expect(result.wind).toBeCloseTo(-39.5)
  })

  it('cold air adds range, hot air subtracts', () => {
    expect(
      weatherCorrection(at2000, weather({ temperature: 5 })).temperature
    ).toBeCloseTo(2)
    expect(
      weatherCorrection(at2000, weather({ temperature: 25 })).temperature
    ).toBeCloseTo(-3)
  })

  it('thin air subtracts range, dense air adds', () => {
    expect(
      weatherCorrection(at2000, weather({ density: 95 })).density
    ).toBeCloseTo(-23.5)
    expect(
      weatherCorrection(at2000, weather({ density: 102 })).density
    ).toBeCloseTo(8.8)
  })

  it('turns into the wind: wind from the right → turn right', () => {
    expect(
      weatherCorrection(at2000, weather({ crosswind: 3 })).azimuth
    ).toBeCloseTo(9.3)
    expect(
      weatherCorrection(at2000, weather({ crosswind: -3 })).azimuth
    ).toBeCloseTo(-9.3)
  })

  it('standard conditions give no correction', () => {
    const result = weatherCorrection(
      at2000,
      weather({ temperature: 15, density: 100 })
    )
    expect(result.total).toBe(0)
    expect(result.azimuth).toBe(0)
    expect(result.missing).toBe(false)
  })

  it('reports missing coefficients for tables without weather', () => {
    const result = weatherCorrection(null, weather({ headwind: 3 }))
    expect(result.missing).toBe(true)
    expect(result.total).toBe(0)
  })
})

describe('solve: weather shifts the lookup range', () => {
  it('uses the corrected range for elevation', () => {
    // +42 м встречного ветра: 2000 → 2042 м
    const solution = solve(WEATHER_ROWS, 2000, 0, weather({ headwind: 5 }))
    expect(solution?.lookupRange).toBeCloseTo(2042)
    expect(solution?.elevation).toBeCloseTo(1241 - (11 * 42) / 50)
  })

  it('returns null when the correction leaves the table', () => {
    expect(
      solve(WEATHER_ROWS, 2090, 0, weather({ headwind: 5 }))
    ).toBeNull()
  })
})

describe('solveAllCharges', () => {
  const profile: BallisticProfile = {
    columns: [],
    units: {},
    modes: {
      HIGH: {
        '1': WEATHER_ROWS,
        '0': BASE_ROWS,
      },
    },
  }

  it('returns charges sorted with out-of-range ones as null', () => {
    const results = solveAllCharges(profile, 'HIGH', undefined, 100, 0)
    expect(results.map((r) => r.charge)).toEqual([0, 1])
    expect(results[0].solution?.elevation).toBe(1495)
    expect(results[1].solution).toBeNull()
    expect(results[1]).toMatchObject({ minRange: 2000, maxRange: 2100 })
  })

  it('respects the allowed charges of the ammunition', () => {
    const results = solveAllCharges(profile, 'HIGH', [1], 2000, 0)
    expect(results.map((r) => r.charge)).toEqual([1])
  })

  it('returns nothing for a mode without tables', () => {
    expect(solveAllCharges(profile, 'LOW', undefined, 100, 0)).toEqual([])
  })

  it('computes the overall range', () => {
    const results = solveAllCharges(profile, 'HIGH', undefined, 100, 0)
    expect(overallRange(results)).toEqual({ min: 50, max: 2100 })
    expect(overallRange([])).toBeNull()
  })

  it('detects weather columns', () => {
    expect(profileHasWeather(profile)).toBe(true)
    expect(
      profileHasWeather({ ...profile, modes: { HIGH: { '0': BASE_ROWS } } })
    ).toBe(false)
  })
})

describe('geometry helpers', () => {
  it('splits wind into head and cross components', () => {
    expect(windComponents(5, 0, 0)).toEqual({ headwind: 5, crosswind: 0 })
    // Ветер с востока при стрельбе на север — справа
    expect(windComponents(5, 90, 0)).toEqual({ headwind: 0, crosswind: 5 })
    expect(windComponents(5, 180, 0)).toEqual({ headwind: -5, crosswind: 0 })
    expect(windComponents(5, 270, 0)).toEqual({ headwind: 0, crosswind: -5 })
  })

  it('computes air density from temperature and pressure', () => {
    expect(airDensityPercent(15, 1013.25)).toBeCloseTo(100)
    expect(airDensityPercent(30, 1013.25)).toBeLessThan(100)
    expect(airDensityPercent(0, 1013.25)).toBeGreaterThan(100)
  })

  it('converts lateral metres to mils', () => {
    expect(lateralCorrectionMil(20, 2000)).toBeCloseTo(10.19, 2)
    expect(lateralCorrectionMil(-20, 2000)).toBeCloseTo(-10.19, 2)
    expect(lateralCorrectionMil(20, 0)).toBe(0)
  })

  it('converts angles and normalizes them', () => {
    expect(degToMil(90)).toBe(1600)
    expect(milToDeg(3200)).toBe(180)
    expect(normalizeAngle(6500, 6400)).toBe(100)
    expect(normalizeAngle(-100, 6400)).toBe(6300)
  })
})

describe('charge choice', () => {
  it('measures metres per mil from the table slope', () => {
    // 2000 → 2050: 11 мил на 50 м → 4.55 м/мил
    expect(metersPerMil(WEATHER_ROWS, 2000)).toBeCloseTo(50 / 11)
    expect(metersPerMil(WEATHER_ROWS, 2025)).toBeCloseTo(50 / 11)
    // Последняя строка — предыдущий промежуток
    expect(metersPerMil(WEATHER_ROWS, 2100)).toBeCloseTo(50 / 11)
    expect(metersPerMil(WEATHER_ROWS, 3000)).toBeNull()
  })

  it('flags the last table interval as the edge', () => {
    expect(isNearTableEdge(WEATHER_ROWS, 2050)).toBe(false)
    expect(isNearTableEdge(WEATHER_ROWS, 2060)).toBe(true)
  })

  const results = [
    { charge: 0, minRange: 0, maxRange: 0, solution: null, metersPerMil: null, nearEdge: false },
    { charge: 1, minRange: 0, maxRange: 0, solution: { tof: 30 } as never, metersPerMil: 2, nearEdge: false },
    { charge: 2, minRange: 0, maxRange: 0, solution: { tof: 20 } as never, metersPerMil: 5, nearEdge: false },
    { charge: 3, minRange: 0, maxRange: 0, solution: { tof: 25 } as never, metersPerMil: 1, nearEdge: true },
  ]

  it('picks by preference among usable charges', () => {
    expect(pickCharge(results, 'lowest')?.charge).toBe(1)
    expect(pickCharge(results, 'fastest')?.charge).toBe(2)
    // Заряд 3 точнее всех, но у края таблицы — берётся заряд 1
    expect(pickCharge(results, 'precise')?.charge).toBe(1)
    // Если остался только заряд у края — берётся он
    expect(pickCharge([results[3]], 'precise')?.charge).toBe(3)
    expect(pickCharge([], 'precise')).toBeUndefined()
  })
})

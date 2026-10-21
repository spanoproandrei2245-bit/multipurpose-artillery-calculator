import type {
  ArtilleryMode,
  BallisticProfile,
  BallisticRow,
} from '../types/artillery'

/** Погодные столбцы таблицы для одной дальности. */
export interface WeatherCoefficients {
  azimuthPerCrosswind: number | null
  rangePerHeadwind: number | null
  rangePerTailwind: number | null
  rangePerTempDec: number | null
  rangePerTempInc: number | null
  rangePerDensityDec: number | null
  rangePerDensityInc: number | null
}

/**
 * Значения, интерполированные по игровой таблице для заданной дальности.
 * null — в таблице игры на этом участке прочерк «-».
 */
export interface TableValues {
  elevation: number
  dElevPer100m: number | null
  dTofPer100m: number | null
  tof: number
  // null — в таблице нет погодных столбцов
  weather: WeatherCoefficients | null
}

/**
 * Погодные условия относительно линии огня.
 * Нули / null означают стандартные условия (поправки нет).
 */
export interface Weather {
  // м/с: > 0 — встречный, < 0 — попутный
  headwind: number
  // м/с: > 0 — дует справа (сносит влево), < 0 — дует слева
  crosswind: number
  // °C; null — стандартные 15 °C
  temperature: number | null
  // % от стандартной плотности; null — 100 %
  density: number | null
}

export const STANDARD_TEMPERATURE = 15
export const STANDARD_DENSITY = 100
export const STANDARD_PRESSURE = 1013.25

export const NO_WEATHER: Weather = {
  headwind: 0,
  crosswind: 0,
  temperature: null,
  density: null,
}

export interface WeatherCorrection {
  // Поправки дальности, м (прибавляются к дальности по таблице)
  wind: number
  temperature: number
  density: number
  total: number
  // Поправка азимута, мил: > 0 — довернуть вправо, < 0 — влево
  azimuth: number
  // Поправка нужна, но в таблице нет данных (прочерк или нет столбцов)
  missing: boolean
}

export interface FiringSolution {
  // Возвышение с учётом разницы высот, мил
  elevation: number
  // Время полёта с учётом разницы высот, с
  tof: number

  // Дальность, по которой взята строка таблицы
  // (дистанция + ручная поправка + погодная поправка)
  lookupRange: number

  // Значения для ровной местности (прямо из таблицы)
  baseElevation: number
  baseTof: number

  // Поправки, уже включённые в elevation и tof
  elevationCorrection: number
  tofCorrection: number

  // Нужна поправка на высоту, но в таблице на этой дальности прочерк
  heightCorrectionMissing: boolean

  weather: WeatherCorrection
}

export interface ChargeResult {
  charge: number
  minRange: number
  maxRange: number
  // null — дальность вне таблицы этого заряда
  solution: FiringSolution | null
  // Ошибка дальности на 1 мил ошибки возвышения, м (меньше — точнее)
  metersPerMil: number | null
  // Решение в последнем промежутке таблицы (у максимальной дальности
  // заряда): поправки здесь менее надёжны
  nearEdge: boolean
  // Между соседними строками таблицы пропуск (шире обычного шага):
  // интерполяция менее точна
  wideGap: boolean
}

/** Как выбирать заряд по умолчанию. */
export type ChargePreference = 'lowest' | 'fastest' | 'precise'

// Поправка на высоту больше этого значения (мил) считается линейной
// оценкой с пониженной точностью.
const LARGE_CORRECTION_MIL = 50

export const MILS_PER_TURN = 6400

export function degToMil(deg: number): number {
  return (deg * MILS_PER_TURN) / 360
}

export function milToDeg(mil: number): number {
  return (mil * 360) / MILS_PER_TURN
}

/**
 * Боковая поправка в милах: сдвинуть разрыв на meters
 * (> 0 — вправо, < 0 — влево) на дистанции distance.
 */
export function lateralCorrectionMil(meters: number, distance: number): number {
  if (distance <= 0) return 0
  return (Math.atan2(meters, distance) * MILS_PER_TURN) / (2 * Math.PI)
}

/** Приведение угла к диапазону [0, full). */
export function normalizeAngle(value: number, full: number): number {
  const result = value % full
  return result < 0 ? result + full : result
}

/**
 * Разложение ветра на встречную и боковую составляющие.
 *
 * windFromDeg — откуда дует ветер (метеорологическое направление), °.
 * azimuthDeg — азимут на цель, °.
 */
export function windComponents(
  speed: number,
  windFromDeg: number,
  azimuthDeg: number
): { headwind: number; crosswind: number } {
  const relative = ((windFromDeg - azimuthDeg) * Math.PI) / 180
  // Убираем шум вроде 3e-16 у ветра, дующего ровно поперёк.
  const clean = (value: number) => Math.round(value * 1e6) / 1e6 || 0
  return {
    headwind: clean(speed * Math.cos(relative)),
    crosswind: clean(speed * Math.sin(relative)),
  }
}

/**
 * Плотность воздуха в % от стандартной (15 °C, 1013.25 гПа),
 * по уравнению состояния идеального газа без учёта влажности.
 */
export function airDensityPercent(
  temperatureC: number,
  pressureHpa: number
): number {
  const kelvin = temperatureC + 273.15
  return (
    (pressureHpa / STANDARD_PRESSURE) *
    ((STANDARD_TEMPERATURE + 273.15) / kelvin) *
    100
  )
}

export function tableRange(rows: readonly BallisticRow[]) {
  return {
    min: rows[0][0],
    max: rows[rows.length - 1][0],
  }
}

export function profileHasWeather(profile: BallisticProfile): boolean {
  return Object.values(profile.modes).some(
    (tables) =>
      tables !== undefined &&
      Object.values(tables).some((rows) => rows[0]?.length === 12)
  )
}

/**
 * Линейная интерполяция между двумя соседними строками таблицы.
 * Возвращает null, если дальность вне диапазона таблицы:
 * экстраполяция не выполняется, чтобы не выдумывать данные.
 * Если одно из соседних значений — прочерк, результат тоже null.
 */
export function interpolateRow(
  rows: readonly BallisticRow[],
  range: number
): TableValues | null {
  if (rows.length === 0 || !Number.isFinite(range)) return null

  const { min, max } = tableRange(rows)
  if (range < min || range > max) return null

  let lo = 0
  let hi = rows.length - 1

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (rows[mid][0] <= range) lo = mid
    else hi = mid
  }

  const a = rows[lo]
  const b = rows[hi]
  const t = b[0] === a[0] ? 0 : (range - a[0]) / (b[0] - a[0])

  function pick(i: number): number | null {
    const x = a[i] ?? null
    const y = b[i] ?? null
    if (t === 0) return x
    if (t === 1) return y
    if (x === null || y === null) return null
    return x + (y - x) * t
  }

  const weather: WeatherCoefficients | null =
    a.length === 12 && b.length === 12
      ? {
          azimuthPerCrosswind: pick(5),
          rangePerHeadwind: pick(6),
          rangePerTailwind: pick(7),
          rangePerTempDec: pick(8),
          rangePerTempInc: pick(9),
          rangePerDensityDec: pick(10),
          rangePerDensityInc: pick(11),
        }
      : null

  return {
    elevation: pick(1) as number,
    dElevPer100m: pick(2),
    dTofPer100m: pick(3),
    tof: pick(4) as number,
    weather,
  }
}

/**
 * Поправка по одному фактору: отклонение от стандарта умножается на
 * столбец «понижение» или «повышение» — в зависимости от знака.
 * Столбцы игры уже содержат знак поправки, поэтому берётся модуль
 * отклонения.
 */
function factorCorrection(
  deviation: number,
  perDecrease: number | null,
  perIncrease: number | null
): { value: number; missing: boolean } {
  if (deviation === 0) return { value: 0, missing: false }
  const coefficient = deviation < 0 ? perDecrease : perIncrease
  if (coefficient === null) return { value: 0, missing: true }
  return { value: Math.abs(deviation) * coefficient, missing: false }
}

/**
 * Погодные поправки по столбцам таблицы.
 *
 * Правило таблиц ACE3: значения столбцов «RANGE CORRECTION FOR» —
 * это метры, которые нужно прибавить к дальности перед выбором
 * возвышения (встречный ветер → положительная поправка, попутный →
 * отрицательная). Поправка азимута дана на 1 м/с бокового ветра;
 * снаряд сносит по ветру, поэтому доворот — навстречу ветру.
 */
export function weatherCorrection(
  coefficients: WeatherCoefficients | null,
  weather: Weather
): WeatherCorrection {
  const temperatureDeviation =
    weather.temperature === null
      ? 0
      : weather.temperature - STANDARD_TEMPERATURE
  const densityDeviation =
    weather.density === null ? 0 : weather.density - STANDARD_DENSITY

  const needed =
    weather.headwind !== 0 ||
    weather.crosswind !== 0 ||
    temperatureDeviation !== 0 ||
    densityDeviation !== 0

  if (coefficients === null) {
    return {
      wind: 0,
      temperature: 0,
      density: 0,
      total: 0,
      azimuth: 0,
      missing: needed,
    }
  }

  // Встречный ветер — «понижение» (столбец HEAD), попутный —
  // «повышение» (столбец TAIL, отрицательные значения).
  const wind = factorCorrection(
    -weather.headwind,
    coefficients.rangePerHeadwind,
    coefficients.rangePerTailwind
  )
  const temperature = factorCorrection(
    temperatureDeviation,
    coefficients.rangePerTempDec,
    coefficients.rangePerTempInc
  )
  const density = factorCorrection(
    densityDeviation,
    coefficients.rangePerDensityDec,
    coefficients.rangePerDensityInc
  )

  let azimuth = 0
  let azimuthMissing = false
  if (weather.crosswind !== 0) {
    if (coefficients.azimuthPerCrosswind === null) azimuthMissing = true
    // Ветер справа (crosswind > 0) сносит влево → доворот вправо.
    else azimuth = weather.crosswind * coefficients.azimuthPerCrosswind
  }

  return {
    wind: wind.value,
    temperature: temperature.value,
    density: density.value,
    total: wind.value + temperature.value + density.value,
    azimuth,
    missing:
      wind.missing ||
      temperature.missing ||
      density.missing ||
      azimuthMissing,
  }
}

/**
 * Расчёт установок для одной дальности и одного заряда.
 *
 * range — дистанция до цели с ручной поправкой, м.
 * heightDiff = высота цели − высота своей позиции, м.
 *
 * 1. По строке для range берутся погодные коэффициенты, и к дальности
 *    прибавляется погодная поправка.
 * 2. По получившейся дальности берётся возвышение и время полёта.
 * 3. Столбцы «D ELEV / TIME OF FLIGHT PER 100 M DR» — изменение
 *    возвышения и времени полёта на каждые 100 м разницы высот.
 *    Правило из вики ACE3: если вы выше цели — прибавить, если ниже —
 *    вычесть. Для цели выше позиции (heightDiff > 0):
 *
 *      elevation = table − (ΔH / 100) · dElev
 *      tof       = table − (ΔH / 100) · dTof
 */
export function solve(
  rows: readonly BallisticRow[],
  range: number,
  heightDiff = 0,
  weather: Weather = NO_WEATHER
): FiringSolution | null {
  const atTarget = interpolateRow(rows, range)
  if (atTarget === null) return null

  const correction = weatherCorrection(atTarget.weather, weather)
  const lookupRange = range + correction.total

  const values =
    correction.total === 0 ? atTarget : interpolateRow(rows, lookupRange)
  if (values === null) return null

  const k = heightDiff / 100
  const needsCorrection = heightDiff !== 0

  const elevationCorrection =
    values.dElevPer100m === null ? 0 : -k * values.dElevPer100m
  const tofCorrection =
    values.dTofPer100m === null ? 0 : -k * values.dTofPer100m

  return {
    elevation: values.elevation + elevationCorrection,
    tof: Math.max(0, values.tof + tofCorrection),
    lookupRange,
    baseElevation: values.elevation,
    baseTof: values.tof,
    elevationCorrection,
    tofCorrection,
    heightCorrectionMissing:
      needsCorrection &&
      (values.dElevPer100m === null || values.dTofPer100m === null),
    weather: correction,
  }
}

/**
 * Чувствительность к ошибке возвышения: сколько метров дальности
 * даёт 1 мил по наклону таблицы в этой точке. На строке берётся
 * следующий промежуток (у последней строки — предыдущий).
 */
export function metersPerMil(
  rows: readonly BallisticRow[],
  range: number
): number | null {
  if (rows.length < 2) return null
  const { min, max } = tableRange(rows)
  if (!Number.isFinite(range) || range < min || range > max) return null

  let i = rows.findIndex((row) => row[0] > range)
  if (i === -1) i = rows.length - 1
  if (i === 0) i = 1

  const a = rows[i - 1]
  const b = rows[i]
  const deltaElevation = Math.abs(b[1] - a[1])
  return deltaElevation === 0 ? null : (b[0] - a[0]) / deltaElevation
}

/** Дальность попала в последний промежуток таблицы. */
export function isNearTableEdge(
  rows: readonly BallisticRow[],
  range: number
): boolean {
  if (rows.length < 3) return false
  return range > rows[rows.length - 2][0]
}

/**
 * Дальность лежит между строками, разнесёнными шире обычного шага
 * таблицы (игра пропускает часть дальностей, особенно в режиме LOW).
 * На самой строке интерполяции нет — пропуск не важен.
 */
export function isWideGap(
  rows: readonly BallisticRow[],
  range: number
): boolean {
  if (rows.length < 3) return false

  const steps = rows
    .slice(1)
    .map((row, i) => row[0] - rows[i][0])
    .sort((a, b) => a - b)
  const typical = steps[Math.floor(steps.length / 2)]

  const i = rows.findIndex((row) => row[0] >= range)
  if (i <= 0 || rows[i][0] === range) return false
  return rows[i][0] - rows[i - 1][0] > 1.5 * typical
}

/**
 * Заряд по умолчанию среди подходящих:
 *   lowest  — наименьший номер;
 *   fastest — кратчайшее время полёта;
 *   precise — наименьшая ошибка дальности на 1 мил.
 * При равенстве — меньший заряд. Для fastest и precise заряды у края
 * таблицы не выбираются, если есть другие.
 */
export function pickCharge(
  results: readonly ChargeResult[],
  preference: ChargePreference
): ChargeResult | undefined {
  const usable = results.filter((r) => r.solution !== null)
  if (preference === 'lowest' || usable.length < 2) return usable[0]

  // Заряды у края таблицы — только если других нет: «точность» там
  // мнимая, поправки ненадёжны.
  const safe = usable.filter((r) => !r.nearEdge)
  const pool = safe.length > 0 ? safe : usable

  const score = (r: ChargeResult) =>
    preference === 'fastest'
      ? r.solution!.tof
      : (r.metersPerMil ?? Number.POSITIVE_INFINITY)

  return pool.reduce((best, r) => (score(r) < score(best) ? r : best))
}

export function isLargeCorrection(solution: FiringSolution): boolean {
  return Math.abs(solution.elevationCorrection) > LARGE_CORRECTION_MIL
}

/**
 * Расчёт по всем зарядам профиля для выбранного режима.
 * Заряды возвращаются по возрастанию номера.
 */
export function solveAllCharges(
  profile: BallisticProfile,
  mode: ArtilleryMode,
  allowedCharges: readonly number[] | undefined,
  range: number,
  heightDiff: number,
  weather: Weather = NO_WEATHER
): ChargeResult[] {
  const tables = profile.modes[mode]
  if (!tables) return []

  return Object.entries(tables)
    .map(([key, rows]) => ({ charge: Number(key), rows }))
    .filter(
      ({ charge }) =>
        allowedCharges === undefined || allowedCharges.includes(charge)
    )
    .sort((a, b) => a.charge - b.charge)
    .map(({ charge, rows }) => {
      const { min, max } = tableRange(rows)
      const solution = solve(rows, range, heightDiff, weather)
      return {
        charge,
        minRange: min,
        maxRange: max,
        solution,
        metersPerMil: solution
          ? metersPerMil(rows, solution.lookupRange)
          : null,
        nearEdge: solution
          ? isNearTableEdge(rows, solution.lookupRange)
          : false,
        wideGap: solution ? isWideGap(rows, solution.lookupRange) : false,
      }
    })
}

/** Общий диапазон дальностей по всем зарядам. */
export function overallRange(results: readonly ChargeResult[]) {
  if (results.length === 0) return null
  return {
    min: Math.min(...results.map((r) => r.minRange)),
    max: Math.max(...results.map((r) => r.maxRange)),
  }
}

/**
 * Лучший способ выстрела среди всех траекторий: для каждой траектории берётся
 * лучший заряд по приоритету, потом они сравниваются между собой.
 * lowest — меньший номер заряда (при равенстве — первая траектория),
 * fastest — меньшее время полёта, precise — меньшая ошибка на 1 мил.
 * Заряды у края таблицы проигрывают любым другим.
 */
export function pickBest<G extends { results: readonly ChargeResult[] }>(
  groups: readonly G[],
  preference: ChargePreference
): { group: G; result: ChargeResult } | undefined {
  const candidates = groups.flatMap((group) => {
    const result = pickCharge(group.results, preference)
    return result ? [{ group, result }] : []
  })
  if (candidates.length === 0) return undefined

  const safe = candidates.filter((c) => !c.result.nearEdge)
  const pool = safe.length > 0 ? safe : candidates

  const score = (c: (typeof pool)[number]) =>
    preference === 'lowest'
      ? c.result.charge
      : preference === 'fastest'
        ? c.result.solution!.tof
        : (c.result.metersPerMil ?? Number.POSITIVE_INFINITY)

  return pool.reduce((best, c) => (score(c) < score(best) ? c : best))
}

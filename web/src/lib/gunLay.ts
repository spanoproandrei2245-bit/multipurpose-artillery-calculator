/**
 * Наводка по мыши: симуляция возвышения ствола танка.
 *
 * Игра ничего не сообщает, поэтому угол восстанавливается по движению мыши:
 * каждый отсчёт мыши по вертикали сдвигает ствол на `milPerCount`. Дрейф
 * гасят упоры: в игре ствол упирается в предел, и симуляция тоже, так что
 * после упора углы снова совпадают.
 */

import { degToMil, milToDeg } from './ballistics'

export interface LaySettings {
  // Сколько мил ствола даёт один отсчёт мыши
  milPerCount: number
  // Нижний и верхний упор ствола, мил
  min: number
  max: number
  // Мышь от себя (вниз) поднимает ствол
  invert: boolean
  // Допуск «угол верный», мил
  tolerance: number
  // Показывать углы в градусах, как в игре (EL: 20.0); внутри всё в милах
  degrees: boolean
  // Окно «выше / ниже» поверх игры: смещение от центра экрана, пиксели (вправо, вниз)
  overlayX: number
  overlayY: number
}

// От -8° до +20°: типичные пределы танкового орудия
export const DEFAULT_LAY_SETTINGS: LaySettings = {
  milPerCount: 0.5,
  min: -142,
  max: 355,
  invert: false,
  tolerance: 1,
  degrees: true,
  overlayX: 150,
  overlayY: -50,
}

export interface LayState {
  // Возвышение ствола в симуляции, мил
  elevation: number
  // Калибровка идёт: отсчёты мыши вверх с нижнего упора; null — не идёт
  calibration: number | null
}

export const INITIAL_LAY_STATE: LayState = { elevation: 0, calibration: null }

export type LayEvent =
  // Отсчёты мыши за короткий промежуток (dy < 0 — мышь от себя вверх)
  | { type: 'move'; dy: number }
  // Ствол стоит на нижнем / верхнем упоре
  | { type: 'low' }
  | { type: 'high' }
  // Первое нажатие: ствол на нижнем упоре, начать счёт.
  // Второе: ствол на верхнем упоре, вывести чувствительность
  | { type: 'calibrate' }
  // Угол прочитан в игре: симуляция встаёт на него, мил
  | { type: 'set'; elevation: number }

// Калибровка короче этого числа отсчётов считается случайным нажатием
export const MIN_CALIBRATION_COUNTS = 20

export function clampElevation(value: number, settings: LaySettings): number {
  return Math.min(settings.max, Math.max(settings.min, value))
}

export function layReduce(
  state: LayState,
  settings: LaySettings,
  event: LayEvent
): { state: LayState; settings: LaySettings } {
  switch (event.type) {
    case 'move': {
      // Движение вверх: отрицательный dy (вниз по экрану — положительный)
      const up = settings.invert ? event.dy : -event.dy
      return {
        settings,
        state: {
          elevation: clampElevation(
            state.elevation + up * settings.milPerCount,
            settings
          ),
          calibration:
            state.calibration === null ? null : state.calibration + up,
        },
      }
    }
    case 'set':
      return {
        settings,
        state: { elevation: clampElevation(event.elevation, settings), calibration: null },
      }
    case 'low':
      return { settings, state: { elevation: settings.min, calibration: null } }
    case 'high':
      return { settings, state: { elevation: settings.max, calibration: null } }
    case 'calibrate': {
      if (state.calibration === null) {
        return { settings, state: { elevation: settings.min, calibration: 0 } }
      }
      // Мало отсчётов: отмена без изменений
      if (state.calibration < MIN_CALIBRATION_COUNTS) {
        return { settings, state: { ...state, calibration: null } }
      }
      return {
        settings: {
          ...settings,
          milPerCount: (settings.max - settings.min) / state.calibration,
        },
        state: { elevation: settings.max, calibration: null },
      }
    }
  }
}

export type LayVerdict = 'ok' | 'raise' | 'lower' | 'unreachable'

export interface LayGuidance {
  // Сколько мил осталось довести: > 0 — поднять, < 0 — опустить
  error: number
  verdict: LayVerdict
  // То же в отсчётах мыши (движение вверх положительно)
  counts: number
}

/** Что делать мышью, чтобы ствол встал на нужное возвышение. */
export function layGuidance(
  elevation: number,
  target: number,
  settings: LaySettings
): LayGuidance {
  const error = target - elevation
  const counts =
    settings.milPerCount > 0 ? Math.round(error / settings.milPerCount) : 0
  let verdict: LayVerdict
  if (target < settings.min - settings.tolerance || target > settings.max + settings.tolerance) {
    verdict = 'unreachable'
  } else if (Math.abs(error) <= settings.tolerance) {
    verdict = 'ok'
  } else {
    verdict = error > 0 ? 'raise' : 'lower'
  }
  return { error, verdict, counts }
}

/** Мил из числа в единицах показа (градусы или мил). */
export function fromDisplay(value: number, settings: LaySettings): number {
  return settings.degrees ? degToMil(value) : value
}

/** Мил в единицы показа. */
export function toDisplay(mil: number, settings: LaySettings): number {
  return settings.degrees ? milToDeg(mil) : mil
}

/** Число в единицах показа: в градусах один знак (20.0, как в игре), в милах целое. */
export function formatLay(
  mil: number,
  settings: LaySettings,
  digits = settings.degrees ? 1 : 0
): string {
  return toDisplay(mil, settings).toFixed(digits)
}

/** Положение на шкале ствола: 0 — нижний упор, 1 — верхний. */
export function layFraction(value: number, settings: LaySettings): number {
  const span = settings.max - settings.min
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (value - settings.min) / span))
}

const SETTINGS_KEY = 'gunLaySettings'
const ELEVATION_KEY = 'gunLayElevation'

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Настройки из хранилища: битые значения заменяются стандартными. */
export function parseLaySettings(raw: string | null): LaySettings {
  const base = DEFAULT_LAY_SETTINGS
  if (!raw) return base
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof LaySettings, unknown>>
    const min = finiteOr(data.min, base.min)
    const max = finiteOr(data.max, base.max)
    if (min >= max) return base
    const milPerCount = finiteOr(data.milPerCount, base.milPerCount)
    return {
      milPerCount: milPerCount > 0 ? milPerCount : base.milPerCount,
      min,
      max,
      invert: data.invert === true,
      tolerance: Math.max(0, finiteOr(data.tolerance, base.tolerance)),
      degrees: data.degrees !== false,
      overlayX: finiteOr(data.overlayX, base.overlayX),
      overlayY: finiteOr(data.overlayY, base.overlayY),
    }
  } catch {
    return base
  }
}

export function loadLaySettings(): LaySettings {
  try {
    return parseLaySettings(localStorage.getItem(SETTINGS_KEY))
  } catch {
    return DEFAULT_LAY_SETTINGS
  }
}

export function saveLaySettings(settings: LaySettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Хранилище недоступно — настройки живут до перезагрузки.
  }
}

export function loadLayElevation(settings: LaySettings): number {
  try {
    const value = Number(localStorage.getItem(ELEVATION_KEY))
    return localStorage.getItem(ELEVATION_KEY) !== null && Number.isFinite(value)
      ? clampElevation(value, settings)
      : clampElevation(0, settings)
  } catch {
    return clampElevation(0, settings)
  }
}

export function saveLayElevation(elevation: number) {
  try {
    localStorage.setItem(ELEVATION_KEY, String(Math.round(elevation * 100) / 100))
  } catch {
    // Хранилище недоступно — угол живёт до перезагрузки.
  }
}

import { MILS_PER_TURN } from './ballistics'

export interface GridPoint {
  // Метры от начала сетки карты: восток, север
  x: number
  y: number
  // Размер квадрата, который задаёт координата, м (точность)
  precision: number
}

/**
 * Разбор координаты сетки Arma: 6, 8 или 10 цифр
 * (100 м, 10 м, 1 м). Пробелы и прочие символы игнорируются.
 * Берётся центр квадрата, чтобы ошибка не превышала половины клетки.
 */
export function parseGrid(value: string): GridPoint | null {
  const digits = value.replace(/\D/g, '')
  if (![6, 8, 10].includes(digits.length)) return null

  const half = digits.length / 2
  const precision = 10 ** (5 - half)

  return {
    x: Number(digits.slice(0, half)) * precision + precision / 2,
    y: Number(digits.slice(half)) * precision + precision / 2,
    precision,
  }
}

/** Дистанция (м) и азимут (мил, 0 = север, по часовой) от a к b. */
export function gridVector(a: GridPoint, b: GridPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const angle = Math.atan2(dx, dy)

  return {
    distance: Math.hypot(dx, dy),
    azimuthMil:
      ((((angle * MILS_PER_TURN) / (2 * Math.PI)) % MILS_PER_TURN) +
        MILS_PER_TURN) %
      MILS_PER_TURN,
    // Худшая точность из двух координат
    precision: Math.max(a.precision, b.precision),
  }
}

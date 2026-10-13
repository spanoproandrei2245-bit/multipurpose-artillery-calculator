import { MILS_PER_TURN } from './ballistics'

/**
 * Поправка, которую нужно внести, м:
 * range > 0 — стрелять дальше, lateral > 0 — правее.
 */
export interface Adjustment {
  range: number
  lateral: number
}

/** Доклад наблюдателя: где лёг разрыв относительно цели, м. */
export interface SpotReport {
  // > 0 — перелёт, < 0 — недолёт
  over: number
  // > 0 — правее цели, < 0 — левее
  right: number
}

/** Поправка противоположна промаху: перелёт → ближе, левее → правее. */
export function reportToAdjustment(report: SpotReport): Adjustment {
  return { range: -report.over || 0, lateral: -report.right || 0 }
}

/**
 * Перевод поправки из системы наблюдателя (линия наблюдатель — цель)
 * в систему орудия (линия орудие — цель).
 *
 * Поправка — вектор на местности. Раскладываем его по осям
 * наблюдателя и проецируем на оси орудия; δ — угол между линиями:
 *
 *   range   = a·cos δ − b·sin δ
 *   lateral = a·sin δ + b·cos δ
 *
 * где a, b — поправка по дальности и направлению у наблюдателя,
 * δ = азимут наблюдателя − азимут орудия.
 */
export function observerToGun(
  adjustment: Adjustment,
  observerAzimuthMil: number,
  gunAzimuthMil: number
): Adjustment {
  const delta =
    ((observerAzimuthMil - gunAzimuthMil) * 2 * Math.PI) / MILS_PER_TURN
  const cos = Math.cos(delta)
  const sin = Math.sin(delta)
  const { range: a, lateral: b } = adjustment

  // Округление до сантиметра убирает шум вроде 3e-15 м.
  const clean = (value: number) => Math.round(value * 100) / 100 || 0

  return {
    range: clean(a * cos - b * sin),
    lateral: clean(a * sin + b * cos),
  }
}

export function sumAdjustments(items: readonly Adjustment[]): Adjustment {
  return items.reduce(
    (total, item) => ({
      range: total.range + item.range,
      lateral: total.lateral + item.lateral,
    }),
    { range: 0, lateral: 0 }
  )
}

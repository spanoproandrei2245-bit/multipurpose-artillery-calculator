import type { ArtilleryMode } from '../types/artillery'

/** Вариант выстрела по цели: режим, заряд и решение для него. */
export interface MrsiOption {
  mode: ArtilleryMode
  charge: number
  elevation: number
  tof: number
}

export interface MrsiShot extends MrsiOption {
  // Когда стрелять, с от первого выстрела
  fireAt: number
}

/**
 * План одновременного удара (MRSI) одним орудием: сначала выстрел с
 * самым долгим полётом, остальные — с задержкой так, чтобы все
 * снаряды упали одновременно.
 *
 * minGap — минимальный интервал между выстрелами (перезарядка), с.
 * Варианты, которые не успеть зарядить, отбрасываются: из близких по
 * времени остаётся тот, что раньше в списке (с более долгим полётом).
 */
export function planMrsi(
  options: readonly MrsiOption[],
  minGap: number
): MrsiShot[] {
  const sorted = [...options].sort((a, b) => b.tof - a.tof)
  if (sorted.length === 0) return []

  const longest = sorted[0].tof
  const plan: MrsiShot[] = []

  for (const option of sorted) {
    const fireAt = longest - option.tof
    const last = plan[plan.length - 1]
    if (last && fireAt - last.fireAt < minGap) continue
    plan.push({ ...option, fireAt })
  }

  return plan
}

import { heightAt, type Heightmap, type MapPoint } from './heightmap'

/**
 * Проверка, не упрётся ли снаряд в рельеф по пути к цели (гора, гребень
 * перед целью на настильной траектории).
 *
 * Таблицы в приложении сняты без сопротивления воздуха, а без него снаряд
 * летит по параболе. По углу возвышения и точкам орудия и цели парабола
 * определяется целиком: y(x) = x·tg θ − (x/D)²·(D·tg θ − Δh). Скорость
 * снаряда для этого не нужна. Если в игре сопротивление всё же есть, дуга
 * идёт выше такой параболы, так что оценка выходит с запасом.
 */

export interface TerrainProfile {
  // Расстояние от орудия до цели по карте, м
  distance: number
  // Высоты рельефа через равный шаг: первая — у орудия, последняя — у цели, м
  heights: number[]
}

export interface Clearance {
  // Наименьший запас снаряда над рельефом, м (меньше нуля — снаряд упрётся)
  min: number
  // Где это: расстояние от орудия, м; высота рельефа и снаряда там, м
  at: number
  terrain: number
  shell: number
}

// Ствол над землёй, м
export const MUZZLE_HEIGHT = 1.5
// Запас меньше этого — «впритык»: деревья и здания в рельефе карты не учтены, м
export const TIGHT_CLEARANCE = 15
// Снаряд ниже рельефа больше чем на столько — «упрётся». Меньше — в пределах
// точности карты высот (и дуга с сопротивлением идёт чуть выше): «впритык», м
export const BLOCK_TOLERANCE = 3
// У орудия и у цели рельеф карты сглажен: первые и последние метры не проверяются
const SKIP_START = 30
const SKIP_END = 20

/** Высоты рельефа по прямой от орудия до цели с шагом не больше maxStep, м. */
export function sampleProfile(
  map: Heightmap,
  gun: MapPoint,
  target: MapPoint,
  maxStep = 10
): TerrainProfile | null {
  const distance = Math.hypot(target.x - gun.x, target.y - gun.y)
  if (distance < 1) return null
  const step = Math.min(maxStep, Math.max(1, map.step / 2))
  const n = Math.max(2, Math.ceil(distance / step))
  const heights: number[] = []
  for (let i = 0; i <= n; i += 1) {
    const f = i / n
    const h = heightAt(map, { x: gun.x + (target.x - gun.x) * f, y: gun.y + (target.y - gun.y) * f })
    if (h === null) return null
    heights.push(h)
  }
  return { distance, heights }
}

/** Высота снаряда над уровнем моря на расстоянии x от орудия, м. */
export function shellHeightAt(
  x: number,
  distance: number,
  gunHeight: number,
  targetHeight: number,
  elevationMil: number
): number {
  const tan = Math.tan((elevationMil * Math.PI) / 3200)
  const rise = targetHeight - gunHeight
  const k = x / distance
  return gunHeight + x * tan - k * k * (distance * tan - rise)
}

// Бугор: рельеф выше прямой «земля у орудия — земля у цели» хотя бы на столько, м
const BULGE = 2

/**
 * Опасное место для выстрела с этим возвышением: где снаряд упирается
 * в рельеф, а если нигде — где он ниже всего проходит над бугром или
 * гребнем. null — по пути нет ни того ни другого.
 *
 * «Впритык» считается только над буграми: у настильной стрельбы снаряд
 * перед целью всегда идёт низко, и на ровной земле это не опасно.
 */
export function clearance(profile: TerrainProfile, elevationMil: number): Clearance | null {
  const { distance, heights } = profile
  const n = heights.length - 1
  if (n < 2) return null
  const gunHeight = heights[0] + MUZZLE_HEIGHT
  const targetHeight = heights[n]
  let hit: Clearance | null = null
  let bump: Clearance | null = null
  for (let i = 1; i < n; i += 1) {
    const x = (i / n) * distance
    if (x < SKIP_START || x > distance - SKIP_END) continue
    const shell = shellHeightAt(x, distance, gunHeight, targetHeight, elevationMil)
    const margin = shell - heights[i]
    const point = { min: margin, at: x, terrain: heights[i], shell }
    if (margin < -BLOCK_TOLERANCE) {
      if (hit === null || margin < hit.min) hit = point
      continue
    }
    const chord = heights[0] + ((targetHeight - heights[0]) * i) / n
    const close = margin < 0 || heights[i] > chord + BULGE
    if (close && (bump === null || margin < bump.min)) bump = point
  }
  return hit ?? bump
}

export const isBlocked = (c: Clearance | null) => c !== null && c.min < -BLOCK_TOLERANCE
export const isTight = (c: Clearance | null) =>
  c !== null && c.min >= -BLOCK_TOLERANCE && c.min < TIGHT_CLEARANCE

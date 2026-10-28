/**
 * Настильная стрельба по конфигу игры: танковые орудия и всё, что стреляет
 * снарядами shotShell с известной скоростью вылета и сопротивлением воздуха.
 *
 * Движение снаряда в Arma 3: ускорение = g + c·|v|·v, где c — airFriction
 * из конфига боеприпаса (отрицательное число). Скорость вылета — initSpeed
 * магазина. Снаряд исчезает через timeToLive секунд.
 *
 * Считается плоская задача: дальность по горизонтали, высота цели
 * относительно среза ствола. Файл без зависимостей: его запускает и скрипт
 * scripts/gen-direct-fire.mjs, которым строятся таблицы.
 */

export const GRAVITY = 9.80665
export const MILS_PER_TURN = 6400

export interface Round {
  // Скорость вылета, м/с
  muzzleSpeed: number
  // airFriction из конфига боеприпаса (меньше нуля)
  airFriction: number
  // Время жизни снаряда, с
  timeToLive: number
}

export interface Flight {
  // Высота снаряда над срезом ствола на этой дальности, м
  height: number
  // Время полёта до этой дальности, с
  tof: number
}

// Шаг интегрирования, с: для RK4 с таким сопротивлением ошибка ничтожна
const STEP = 0.02

interface State {
  x: number
  y: number
  vx: number
  vy: number
}

function derivative(s: State, c: number): State {
  const speed = Math.hypot(s.vx, s.vy)
  return { x: s.vx, y: s.vy, vx: c * speed * s.vx, vy: -GRAVITY + c * speed * s.vy }
}

function advance(s: State, c: number, h: number): State {
  const k1 = derivative(s, c)
  const k2 = derivative(
    { x: s.x + (h / 2) * k1.x, y: s.y + (h / 2) * k1.y, vx: s.vx + (h / 2) * k1.vx, vy: s.vy + (h / 2) * k1.vy },
    c
  )
  const k3 = derivative(
    { x: s.x + (h / 2) * k2.x, y: s.y + (h / 2) * k2.y, vx: s.vx + (h / 2) * k2.vx, vy: s.vy + (h / 2) * k2.vy },
    c
  )
  const k4 = derivative(
    { x: s.x + h * k3.x, y: s.y + h * k3.y, vx: s.vx + h * k3.vx, vy: s.vy + h * k3.vy },
    c
  )
  return {
    x: s.x + (h / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: s.y + (h / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    vx: s.vx + (h / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
    vy: s.vy + (h / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
  }
}

/**
 * Полёт до заданной дальности при этом угле возвышения, рад.
 * null — снаряд не долетел: упал, исчез по времени жизни или остановился.
 */
export function flightAtRange(round: Round, elevation: number, range: number): Flight | null {
  let s: State = {
    x: 0,
    y: 0,
    vx: round.muzzleSpeed * Math.cos(elevation),
    vy: round.muzzleSpeed * Math.sin(elevation),
  }
  let t = 0
  while (t < round.timeToLive) {
    const next = advance(s, round.airFriction, STEP)
    const nextT = t + STEP
    if (next.x >= range) {
      // Последний шаг делится по дальности
      const f = (range - s.x) / (next.x - s.x)
      return { height: s.y + (next.y - s.y) * f, tof: t + STEP * f }
    }
    // Упал далеко ниже среза ствола или не движется вперёд: дальше не долетит
    if (next.y < -5000 || next.vx <= 1) return null
    s = next
    t = nextT
  }
  return null
}

export interface Solution {
  // Угол возвышения, рад
  elevation: number
  tof: number
}

const MIN_ELEVATION = -0.2
// Решение принимается, если снаряд проходит так близко к цели, м
const HIT_TOLERANCE = 0.5

/**
 * Угол возвышения, при котором снаряд проходит через точку на этой дальности
 * и разнице высот (цель минус срез ствола), по нижней траектории.
 * null — цель не достать: нужен угол выше предела орудия, снаряд не долетит
 * за время жизни или цель выше, чем можно навести.
 */
export function solveElevation(
  round: Round,
  range: number,
  heightDiff: number,
  maxElevation: number
): Solution | null {
  const low = flightAtRange(round, MIN_ELEVATION, range)
  // Низ диапазона пролетает выше цели: цель ниже, чем можно навести
  if (low !== null && low.height > heightDiff) return null

  // Снаряд, взятый круто, на этой дальности может не оказаться вовсе (сопротивление,
  // время жизни), поэтому «не долетел» значит «угол слишком велик», а «долетел,
  // но ниже цели» — «слишком мал»
  let lo = MIN_ELEVATION
  let hi = maxElevation
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2
    const flight = flightAtRange(round, mid, range)
    if (flight !== null && flight.height < heightDiff) lo = mid
    else hi = mid
  }
  const elevation = (lo + hi) / 2
  const flight = flightAtRange(round, elevation, range)
  // Сошлось не к цели, а к границе достижимости: достать нельзя
  if (flight === null || Math.abs(flight.height - heightDiff) > HIT_TOLERANCE) return null
  return { elevation, tof: flight.tof }
}

export const radToMil = (rad: number) => (rad * MILS_PER_TURN) / (2 * Math.PI)
export const degToRad = (deg: number) => (deg * Math.PI) / 180

export interface DirectFireRow {
  range: number
  // мил
  elevation: number
  // мил и с на 100 м разницы высот (как в игровых таблицах)
  dElevPer100m: number | null
  dTofPer100m: number | null
  tof: number
}

// Разница высот для производной: ± столько метров
const DELTA = 50

/**
 * Таблица дальность - возвышение - время полёта для ровной местности,
 * как игровая таблица ACE: тот же формат строк и те же поправки на разницу
 * высот (на 100 м; считаются по двум решениям +/-50 м).
 * Дальности идут с шагом `step` до последней, которой ещё можно достать.
 */
export function buildTable(
  round: Round,
  maxElevationDeg: number,
  options: { step?: number; first?: number } = {}
): DirectFireRow[] {
  const step = options.step ?? 50
  const first = options.first ?? step
  const maxElevation = degToRad(maxElevationDeg)
  const rows: DirectFireRow[] = []

  for (let range = first; ; range += step) {
    const flat = solveElevation(round, range, 0, maxElevation)
    if (flat === null) break

    const above = solveElevation(round, range, DELTA, maxElevation)
    const below = solveElevation(round, range, -DELTA, maxElevation)
    // Как в таблицах: elevation(Δ) = table - (Δ/100)·dElev, Δ = цель минус орудие
    const span = above && below ? (DELTA * 2) / 100 : null
    rows.push({
      range,
      elevation: radToMil(flat.elevation),
      dElevPer100m:
        above && below && span ? -radToMil(above.elevation - below.elevation) / span : null,
      dTofPer100m: above && below && span ? -(above.tof - below.tof) / span : null,
      tof: flat.tof,
    })
  }
  return rows
}

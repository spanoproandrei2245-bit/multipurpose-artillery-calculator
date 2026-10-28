import { describe, expect, it } from 'vitest'

import {
  GRAVITY,
  buildTable,
  degToRad,
  flightAtRange,
  radToMil,
  solveElevation,
  type Round,
} from './directFire'

// Боеприпас без сопротивления: можно сверить с формулой параболы
const vacuum: Round = { muzzleSpeed: 800, airFriction: 0, timeToLive: 60 }
// Параметры 120 мм APFSDS-T из конфига Меркавы
const apfsds: Round = { muzzleSpeed: 1670, airFriction: -3.96e-5, timeToLive: 15 }
const he: Round = { muzzleSpeed: 1410, airFriction: -0.000275, timeToLive: 15 }

describe('flightAtRange', () => {
  it('без сопротивления совпадает с параболой', () => {
    const angle = degToRad(5)
    const range = 3000
    const flight = flightAtRange(vacuum, angle, range)!
    const t = range / (vacuum.muzzleSpeed * Math.cos(angle))
    expect(flight.tof).toBeCloseTo(t, 3)
    const height = vacuum.muzzleSpeed * Math.sin(angle) * t - 0.5 * GRAVITY * t * t
    expect(flight.height).toBeCloseTo(height, 2)
  })

  it('сопротивление замедляет: дольше летит и ниже на той же дальности', () => {
    const angle = degToRad(2)
    const dragged = flightAtRange(he, angle, 3000)!
    const free = flightAtRange({ ...he, airFriction: 0 }, angle, 3000)!
    expect(dragged.tof).toBeGreaterThan(free.tof)
    expect(dragged.height).toBeLessThan(free.height)
  })

  it('не долетает, если время жизни меньше полёта', () => {
    expect(flightAtRange({ ...vacuum, timeToLive: 1 }, degToRad(1), 5000)).toBeNull()
  })
})

describe('solveElevation', () => {
  it('найденный угол попадает в точку', () => {
    const solved = solveElevation(apfsds, 2000, 0, degToRad(20))!
    const flight = flightAtRange(apfsds, solved.elevation, 2000)!
    expect(Math.abs(flight.height)).toBeLessThan(0.01)
    expect(flight.tof).toBeCloseTo(solved.tof, 6)
  })

  it('более высокая цель требует большего угла', () => {
    const flat = solveElevation(apfsds, 2000, 0, degToRad(20))!
    const up = solveElevation(apfsds, 2000, 30, degToRad(20))!
    const down = solveElevation(apfsds, 2000, -30, degToRad(20))!
    expect(up.elevation).toBeGreaterThan(flat.elevation)
    expect(down.elevation).toBeLessThan(flat.elevation)
  })

  it('дальше предела по углу достать нельзя', () => {
    expect(solveElevation(he, 12000, 0, degToRad(20))).toBeNull()
  })

  it('на 2 км APFSDS нужен угол порядка 4 мил (проверка здравым смыслом)', () => {
    // Скорость около 1600 м/с, полёт около 1.25 с, падение около 7.6 м на 2 км
    const mil = radToMil(solveElevation(apfsds, 2000, 0, degToRad(20))!.elevation)
    expect(mil).toBeGreaterThan(3)
    expect(mil).toBeLessThan(6)
  })
})

describe('buildTable', () => {
  const table = buildTable(he, 20)

  it('дальность растёт шагом 50 м, возвышение и время растут', () => {
    expect(table[0].range).toBe(50)
    for (let i = 1; i < table.length; i += 1) {
      expect(table[i].range - table[i - 1].range).toBe(50)
      expect(table[i].elevation).toBeGreaterThan(table[i - 1].elevation)
      expect(table[i].tof).toBeGreaterThan(table[i - 1].tof)
    }
  })

  it('таблица кончается там, где упор по углу или время жизни снаряда', () => {
    const last = table[table.length - 1]
    const byAngle = radToMil(degToRad(20)) - last.elevation < 60
    const byLifetime = he.timeToLive - last.tof < 0.5
    expect(byAngle || byLifetime).toBe(true)
    expect(solveElevation(he, last.range + 50, 0, degToRad(20))).toBeNull()
  })

  it('предел угла обрезает таблицу раньше, если он мал', () => {
    const short = buildTable(apfsds, 0.5)
    const long = buildTable(apfsds, 20)
    expect(short.length).toBeLessThan(long.length)
    expect(radToMil(degToRad(0.5)) - short[short.length - 1].elevation).toBeLessThan(2)
  }, 60000)

  it('поправка на высоту цели по знаку как в игровых таблицах', () => {
    // Для настильной стрельбы dElev отрицательна: цель выше орудия, угол больше
    const row = table.find((r) => r.range === 2000)!
    expect(row.dElevPer100m).not.toBeNull()
    expect(row.dElevPer100m!).toBeLessThan(0)
    // Примерно 100 м / 2000 м = 50 мил (с поправкой на траекторию)
    expect(Math.abs(row.dElevPer100m!)).toBeGreaterThan(40)
    expect(Math.abs(row.dElevPer100m!)).toBeLessThan(60)
  })

  it('у APFSDS таблица длиннее, чем у HE, при том же пределе угла или упирается во время жизни', () => {
    const ap = buildTable(apfsds, 20)
    expect(ap.length).toBeGreaterThan(table.length)
    expect(ap[ap.length - 1].tof).toBeLessThanOrEqual(15)
  }, 60000)
})

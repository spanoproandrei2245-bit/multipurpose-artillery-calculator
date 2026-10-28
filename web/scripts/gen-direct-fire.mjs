#!/usr/bin/env node
/**
 * Справочник настильного орудия (танк) из конфига игры.
 *
 *   node scripts/gen-direct-fire.mjs [id]            все конфиги scripts/direct-fire/*.config.json
 *   node scripts/gen-direct-fire.mjs merkava_mk4     один
 *
 * Конфиг выгружен из игры скриптом tools/arma/dump_vehicle.sqf. Из скорости
 * вылета и сопротивления воздуха строится таблица дальность - возвышение -
 * время полёта (src/lib/directFire.ts) в формате игровых таблиц; результат
 * пишется в src/data/artillery/<id>.json. Запуск: Node 22.6+ (читает .ts).
 *
 * Если рядом есть <id>.engine.txt (строки GRADBRIDGE|phys| из журнала игры после
 * tools/arma/dump_physics.sqf), возвышения берутся из него: это полёт, посчитанный
 * самим движком игры. Модель остаётся для проверки и для времени полёта, если
 * замер времени не атомарный.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildTable, degToRad, radToMil } from '../src/lib/directFire.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const configDir = join(root, 'scripts', 'direct-fire')
const only = process.argv[2]

const round = (value, digits) => {
  const factor = 10 ** digits
  const result = Math.round(value * factor) / factor
  // -0 в JSON не нужен
  return Object.is(result, -0) ? 0 : result
}

/**
 * Замеры движка: класс боеприпаса -> уровень высоты (м относительно среза) ->
 * точки {angle, dist, tof} по возрастанию угла. Точки, где снаряд не дошёл
 * (none) или дальность не растёт, отбрасываются.
 */
function parseEngine(text) {
  const atomic = /\|start\|atomic=1/.test(text)
  // Новый скрипт ловит подъём через уровни выше ствола (цель выше орудия), старый только спуск
  const upCrossing = /\|start\|[^\n]*crossing=asc/.test(text)
  const byAmmo = {}
  for (const line of text.split(/\r?\n/)) {
    const p = line.replace(/"$/, '').split('|')
    if (p.length < 5 || p[3] === 'none' || !p[2].startsWith('lvl=')) continue
    const kv = Object.fromEntries(p.slice(3).map((item) => item.split('=')))
    const level = Number(p[2].slice(4))
    // Спуск через уровень выше ствола относится к крутой траектории: не годится
    if (level > 0 && !upCrossing) continue
    const point = { angle: Number(p[1]), dist: Number(kv.dist), tof: Number(kv.tof) }
    if (!(point.dist > 0)) continue
    ;((byAmmo[p[0]] ??= {})[level] ??= []).push(point)
  }
  for (const levels of Object.values(byAmmo)) {
    for (const [level, all] of Object.entries(levels)) {
      // Журнал может содержать несколько прогонов: точки с одним углом усредняются
      const byAngle = new Map()
      for (const point of all) {
        const list = byAngle.get(point.angle) ?? []
        list.push(point)
        byAngle.set(point.angle, list)
      }
      const points = [...byAngle.entries()]
        .map(([angle, list]) => ({
          angle,
          dist: list.reduce((sum, p) => sum + p.dist, 0) / list.length,
          tof: list.reduce((sum, p) => sum + p.tof, 0) / list.length,
        }))
        // Через уровень выше ствола подъём: чем круче, тем ближе; сортировка по дальности
        .sort(Number(level) > 0 ? (a, b) => a.dist - b.dist : (a, b) => a.angle - b.angle)
      const kept = []
      for (const point of points) {
        if (kept.length > 0 && point.dist <= kept[kept.length - 1].dist) {
          if (Number(level) > 0) continue
          break
        }
        kept.push(point)
      }
      levels[level] = kept
    }
  }
  return { atomic, byAmmo }
}

/** Угол (градусы) и время, при которых снаряд проходит уровень на этой дальности. */
function atRange(points, range) {
  if (!points || points.length < 2) return null
  if (range < points[0].dist || range > points[points.length - 1].dist) return null
  let i = 1
  while (points[i].dist < range) i += 1
  const a = points[i - 1]
  const b = points[i]
  const f = (range - a.dist) / (b.dist - a.dist)
  return { angle: a.angle + f * (b.angle - a.angle), tof: a.tof + f * (b.tof - a.tof) }
}

const degToMil = (deg) => (deg * 6400) / 360

function fromEngine(item, engine, modelRows) {
  const levels = engine.byAmmo[item.ammo]
  if (!levels) return null
  const modelByRange = new Map(modelRows.map((row) => [row[0], row]))
  const rows = []
  for (let range = 50; ; range += 50) {
    const flat = atRange(levels[0], range)
    if (!flat) {
      // До первой точки замера (малые дальности) строк нет, после последней таблица кончается
      if (rows.length === 0 && range < 2000) continue
      break
    }
    const up = atRange(levels[50], range)
    const down = atRange(levels[-50], range)
    const model = modelByRange.get(range)
    // Поправка на высоту: из замера двух уровней; нет замера (цель выше недостижима) - из модели
    const dElev =
      up && down ? -(degToMil(up.angle) - degToMil(down.angle)) : model && model[2] !== null ? model[2] : null
    // Время полёта: из замера, если он снят атомарно; иначе из модели (замер времени плавает на 0.03-0.05 с)
    const tof = engine.atomic ? flat.tof : model ? model[4] : flat.tof
    const dTof = engine.atomic
      ? up && down
        ? -(up.tof - down.tof)
        : null
      : model && model[3] !== null
        ? model[3]
        : null
    rows.push([
      range,
      round(degToMil(flat.angle), 2),
      dElev === null ? null : round(dElev, 2),
      dTof === null ? null : round(dTof, 3),
      round(tof, 2),
    ])
  }
  return rows
}

function build(config, engine) {
  const { vehicle } = config
  const profiles = {}
  const ammunition = []

  for (const item of config.rounds) {
    const modelRows = buildTable(
      { muzzleSpeed: item.muzzleSpeed, airFriction: item.airFriction, timeToLive: item.timeToLive },
      vehicle.maxElevDeg
    ).map((row) => [
      row.range,
      round(row.elevation, 2),
      row.dElevPer100m === null ? null : round(row.dElevPer100m, 2),
      row.dTofPer100m === null ? null : round(row.dTofPer100m, 3),
      round(row.tof, 2),
    ])
    const engineRows = engine ? fromEngine(item, engine, modelRows) : null
    const rows = engineRows ?? modelRows
    if (engineRows) {
      // Насколько модель расходится с движком: по возвышению на общих дальностях, мил
      const model = new Map(modelRows.map((row) => [row[0], row[1]]))
      let worst = 0
      for (const row of engineRows) {
        const m = model.get(row[0])
        if (m !== undefined) worst = Math.max(worst, Math.abs(m - row[1]))
      }
      console.log(`  ${item.id}: model vs engine, worst elevation difference ${worst.toFixed(2)} mil`)
    }

    profiles[item.id] = {
      columns: ['range', 'elevation', 'dElevPer100m', 'dTofPer100m', 'tof'],
      units: { range: 'm', elevation: 'mil', dElevPer100m: 'mil', dTofPer100m: 's', tof: 's' },
      notes:
        (engineRows
          ? `Measured on the game engine (tools/arma/dump_physics.sqf): shells of ${item.ammo} launched at ${item.muzzleSpeed} m/s ` +
            'at many elevations, the range and time at which each crosses the launch height and +-50 m. '
          : `Computed, not read from an in-game table: muzzle speed ${item.muzzleSpeed} m/s (magazine ${item.magazine}), ` +
            `airFriction ${item.airFriction} (${item.ammo}), shell lifetime ${item.timeToLive} s, g = 9.80665. `) +
        'Elevation is the low trajectory over flat ground relative to the muzzle; the table ends where the gun ' +
        `elevation limit (${vehicle.maxElevDeg} deg) or the shell lifetime stops the shot. dElevPer100m and dTofPer100m ` +
        'are the change per 100 m of height difference (same sign convention as the in-game artillery tables).',
      modes: { LOW: { 0: rows } },
    }

    ammunition.push({
      id: item.id,
      designation: item.designation,
      type: item.type,
      description: `${vehicle.displayName} (${vehicle.class}), ${item.magazine}. ${engineRows ? 'Elevations measured on the game engine' : 'Computed from the game config'}; needs a check by firing.`,
      verified: false,
      charges: [0],
      // Сопротивление воздуха в расчёте уже есть всегда: тот же профиль и для игры
      // с улучшенной баллистикой, чтобы калькулятор не предупреждал о «подмене» таблицы
      profile: item.id,
      advancedProfile: item.id,
    })
  }

  return {
    schemaVersion: 1,
    id: config.id,
    name: config.name,
    modification: config.modification,
    availableModes: ['LOW'],
    source: {
      name: engine ? `${config.source} Engine sweep: tools/arma/dump_physics.sqf.` : config.source,
      status: 'in-progress',
    },
    screenshots: [],
    limits: {
      minElevation: round(radToMil(degToRad(vehicle.minElevDeg)), 1),
      maxElevation: round(radToMil(degToRad(vehicle.maxElevDeg)), 1),
    },
    ammunition,
    profiles,
  }
}

for (const file of readdirSync(configDir).filter((f) => f.endsWith('.config.json'))) {
  const config = JSON.parse(readFileSync(join(configDir, file), 'utf8'))
  if (only && config.id !== only) continue
  const enginePath = join(configDir, `${config.id}.engine.txt`)
  const engine = existsSync(enginePath) ? parseEngine(readFileSync(enginePath, 'utf8')) : null
  console.log(`${config.id}: ${engine ? (engine.atomic ? 'engine data (atomic timing)' : 'engine data (timing from model)') : 'model only'}`)
  const reference = build(config, engine)
  const target = join(root, 'src', 'data', 'artillery', `${config.id}.json`)
  writeFileSync(target, JSON.stringify(reference, null, 2) + '\n')
  for (const [id, profile] of Object.entries(reference.profiles)) {
    const rows = profile.modes.LOW[0]
    const last = rows[rows.length - 1]
    console.log(`${config.id}/${id}: ${rows.length} rows, ${rows[0][0]}-${last[0]} m, last elevation ${last[1]} mil, tof ${last[4]} s`)
  }
}

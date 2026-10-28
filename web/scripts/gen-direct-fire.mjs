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
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

function build(config) {
  const { vehicle } = config
  const profiles = {}
  const ammunition = []

  for (const item of config.rounds) {
    const rows = buildTable(
      { muzzleSpeed: item.muzzleSpeed, airFriction: item.airFriction, timeToLive: item.timeToLive },
      vehicle.maxElevDeg
    ).map((row) => [
      row.range,
      round(row.elevation, 2),
      row.dElevPer100m === null ? null : round(row.dElevPer100m, 2),
      row.dTofPer100m === null ? null : round(row.dTofPer100m, 3),
      round(row.tof, 2),
    ])

    profiles[item.id] = {
      columns: ['range', 'elevation', 'dElevPer100m', 'dTofPer100m', 'tof'],
      units: { range: 'm', elevation: 'mil', dElevPer100m: 'mil', dTofPer100m: 's', tof: 's' },
      notes:
        `Computed, not read from an in-game table: muzzle speed ${item.muzzleSpeed} m/s (magazine ${item.magazine}), ` +
        `airFriction ${item.airFriction} (${item.ammo}), shell lifetime ${item.timeToLive} s, g = 9.80665. ` +
        'Elevation is the low trajectory over flat ground relative to the barrel; the table ends where the gun ' +
        `elevation limit (${vehicle.maxElevDeg} deg) or the shell lifetime stops the shot. dElevPer100m and dTofPer100m ` +
        'are the change per 100 m of height difference (same sign convention as the in-game artillery tables).',
      modes: { LOW: { 0: rows } },
    }

    ammunition.push({
      id: item.id,
      designation: item.designation,
      type: item.type,
      description: `${vehicle.displayName} (${vehicle.class}), ${item.magazine}. Computed from the game config; needs a check by firing.`,
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
    source: { name: config.source, status: 'in-progress' },
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
  const reference = build(config)
  const target = join(root, 'src', 'data', 'artillery', `${config.id}.json`)
  writeFileSync(target, JSON.stringify(reference, null, 2) + '\n')
  for (const [id, profile] of Object.entries(reference.profiles)) {
    const rows = profile.modes.LOW[0]
    const last = rows[rows.length - 1]
    console.log(`${config.id}/${id}: ${rows.length} rows, ${rows[0][0]}-${last[0]} m, last elevation ${last[1]} mil, tof ${last[4]} s`)
  }
}

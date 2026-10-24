import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

describe('scripts/import-rpt.mjs', () => {
  it('собирает папку в формате grad_meh из RPT скрипта gradtopo_export.sqf', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rpt-'))
    const n = 3
    const lines = [
      '12:00:00 шум до экспорта',
      `GRADTOPO|META|testworld|40|20|${n}`,
      ...[0, 1, 2].map((j) => `GRADTOPO|H|${j}|0|${[10 * j, 20 * j + 5, 30 * j].join(',')}`),
      'GRADTOPO|B|0,0,10,0,10,5,0,5|6',
      'GRADTOPO|R|MAIN ROAD|8|0,0,10,0',
      'GRADTOPO|R|MAIN ROAD|8|10,0,20,5',
      'GRADTOPO|L|NameVillage|Деревня|15|15',
      'GRADTOPO|END',
    ]
    const rpt = join(dir, 'test.rpt')
    writeFileSync(rpt, lines.join('\n'))
    const out = join(dir, 'export')
    execFileSync('node', ['scripts/import-rpt.mjs', rpt, out, '--name', 'Test World'])

    const meta = JSON.parse(readFileSync(join(out, 'meta.json'), 'utf8'))
    expect(meta.worldName).toBe('testworld')
    expect(meta.displayName).toBe('Test World')
    expect(meta.worldSize).toBe(40)

    const asc = gunzipSync(readFileSync(join(out, 'dem.asc.gz'))).toString().split('\n')
    expect(asc[0]).toBe('ncols 3')
    // Первая строка сетки — север (j = 2)
    expect(asc[6].split(' ')[0]).toBe('2.0')
    expect(asc[8].split(' ')[0]).toBe('0.0')

    const houses = JSON.parse(gunzipSync(readFileSync(join(out, 'geojson', 'house.geojson.gz'))).toString())
    expect(houses).toHaveLength(1)
    expect(houses[0].geometry.coordinates[0]).toHaveLength(5)

    // Два отрезка одной дороги склеены в одну ломаную
    const road = JSON.parse(gunzipSync(readFileSync(join(out, 'geojson', 'roads', 'main_road.geojson.gz'))).toString())
    expect(road).toHaveLength(1)
    expect(road[0].geometry.coordinates).toHaveLength(3)

    expect(existsSync(join(out, 'geojson', 'locations', 'namevillage.geojson.gz'))).toBe(true)
  })
})

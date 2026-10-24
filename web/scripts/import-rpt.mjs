#!/usr/bin/env node
/**
 * Данные карты из RPT-файла (скрипт tools/arma/gradtopo_export.sqf) → папка в формате
 * выгрузки grad_meh без спутника: meta.json, dem.asc.gz, geojson/*.geojson.gz.
 *
 *   node scripts/import-rpt.mjs <файл.rpt> <папка-выгрузки> [--name "Cam Lao Nam"] [--author "SOG"]
 *
 * Дальше (карта без спутника, только топо):
 *   node scripts/import-grad-meh.mjs --no-sat "<папка-выгрузки>"
 */
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { gzipSync } from 'node:zlib'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))
const [rptFile, outDir] = positional
if (!rptFile || !outDir) {
  console.error('usage: node scripts/import-rpt.mjs <file.rpt> <out folder> [--name "..."] [--author "..."]')
  process.exit(1)
}

let meta = null
let grid = null
const houses = []
const segments = { main_road: [], road: [], track: [], trail: [] }
const locations = new Map()
let ended = false

const roadKind = (type) => {
  const t = type.toUpperCase()
  if (t.includes('MAIN')) return 'main_road'
  if (t === 'TRACK') return 'track'
  if (t === 'TRAIL') return 'trail'
  return 'road'
}

const lines = createInterface({ input: createReadStream(rptFile, 'utf8'), crlfDelay: Infinity })
for await (const raw of lines) {
  const at = raw.indexOf('GRADTOPO|')
  if (at < 0) continue
  const parts = raw.slice(at + 9).trim().split('|')
  switch (parts[0]) {
    case 'META': {
      // Новый запуск скрипта в том же RPT начинает всё заново
      meta = { worldName: parts[1], worldSize: Number(parts[2]), step: Number(parts[3]), n: Number(parts[4]) }
      grid = new Float32Array(meta.n * meta.n)
      houses.length = 0
      for (const k of Object.keys(segments)) segments[k].length = 0
      locations.clear()
      ended = false
      break
    }
    case 'H': {
      if (!meta) break
      const j = Number(parts[1])
      const i0 = Number(parts[2])
      parts[3].split(',').forEach((v, k) => {
        grid[j * meta.n + i0 + k] = Number(v) / 10
      })
      break
    }
    case 'B': {
      const c = parts[1].split(',').map(Number)
      if (c.length !== 8) break
      const ring = [[c[0], c[1]], [c[2], c[3]], [c[4], c[5]], [c[6], c[7]]]
      houses.push({ ring, height: Number(parts[2]) || 0 })
      break
    }
    case 'R': {
      const c = parts[3].split(',').map(Number)
      if (c.length !== 4 || (c[0] === c[2] && c[1] === c[3])) break
      segments[roadKind(parts[1])].push([[c[0], c[1]], [c[2], c[3]]])
      break
    }
    case 'L': {
      const type = parts[1].toLowerCase()
      if (!locations.has(type)) locations.set(type, [])
      locations.get(type).push({ name: parts[2], x: Number(parts[3]), y: Number(parts[4]) })
      break
    }
    case 'END':
      ended = true
      break
  }
}

if (!meta) {
  console.error('В RPT нет строк GRADTOPO|META — скрипт не запускался или лог другой.')
  process.exit(1)
}
if (!ended) console.warn('ВНИМАНИЕ: нет строки GRADTOPO|END — экспорт мог не закончиться, данные неполные.')

// Склейка отрезков дорог в ломаные
function join_(segs) {
  const key = (p) => `${p[0]},${p[1]}`
  const byEnd = new Map()
  segs.forEach((s, i) => {
    for (const p of s) {
      if (!byEnd.has(key(p))) byEnd.set(key(p), [])
      byEnd.get(key(p)).push(i)
    }
  })
  const used = new Uint8Array(segs.length)
  const take = (p) => {
    for (const i of byEnd.get(key(p)) ?? []) if (!used[i]) return i
    return -1
  }
  const out = []
  for (let i = 0; i < segs.length; i += 1) {
    if (used[i]) continue
    used[i] = 1
    const line = [...segs[i]]
    for (;;) {
      const nxt = take(line[line.length - 1])
      if (nxt < 0) break
      used[nxt] = 1
      const [a, b] = segs[nxt]
      line.push(key(a) === key(line[line.length - 1]) ? b : a)
    }
    for (;;) {
      const nxt = take(line[0])
      if (nxt < 0) break
      used[nxt] = 1
      const [a, b] = segs[nxt]
      line.unshift(key(a) === key(line[0]) ? b : a)
    }
    out.push(line)
  }
  return out
}

const gz = (file, features) => writeFileSync(file, gzipSync(JSON.stringify(features)))
mkdirSync(join(outDir, 'geojson', 'roads'), { recursive: true })
mkdirSync(join(outDir, 'geojson', 'locations'), { recursive: true })

writeFileSync(
  join(outDir, 'meta.json'),
  JSON.stringify(
    {
      worldName: meta.worldName,
      displayName: flag('--name') ?? meta.worldName,
      author: flag('--author') ?? '',
      worldSize: meta.worldSize,
      colorOutside: [0.96, 0.95, 0.92, 1],
      // Карта без спутникового снимка: только топо
      source: 'gradtopo',
    },
    null,
    2
  ) + '\n'
)

// ESRI ASCII: строка 0 — север
const { n, step } = meta
const asc = [`ncols ${n}`, `nrows ${n}`, 'xllcorner 0', 'yllcorner 0', `cellsize ${step}`, 'NODATA_value -9999']
for (let j = n - 1; j >= 0; j -= 1) {
  const row = []
  for (let i = 0; i < n; i += 1) row.push(grid[j * n + i].toFixed(1))
  asc.push(row.join(' '))
}
writeFileSync(join(outDir, 'dem.asc.gz'), gzipSync(asc.join('\n') + '\n'))

gz(
  join(outDir, 'geojson', 'house.geojson.gz'),
  houses.map((h) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[...h.ring, h.ring[0]]] },
    properties: { height: h.height },
  }))
)
for (const [kind, segs] of Object.entries(segments)) {
  if (segs.length === 0) continue
  gz(
    join(outDir, 'geojson', 'roads', `${kind}.geojson.gz`),
    join_(segs).map((line) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: line },
      properties: { width: 1 },
    }))
  )
}
for (const [type, list] of locations) {
  gz(
    join(outDir, 'geojson', 'locations', `${type}.geojson.gz`),
    list.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.x, l.y] },
      properties: { name: l.name, angle: 0, radiusA: 100, radiusB: 100 },
    }))
  )
}

console.log(
  `${meta.worldName}: сетка ${n}×${n} (шаг ${step} м), зданий ${houses.length}, дорожных отрезков ${Object.values(segments).reduce((a, s) => a + s.length, 0)}, названий ${[...locations.values()].reduce((a, l) => a + l.length, 0)}`
)
console.log(`Папка: ${outDir}\nДальше: node scripts/import-grad-meh.mjs --no-sat "${outDir}"`)

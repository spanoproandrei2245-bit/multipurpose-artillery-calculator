#!/usr/bin/env node
/**
 * Импорт игровых таблиц ACE3 из текстовых файлов в JSON-справочник.
 *
 *   node scripts/import-tables.mjs <папка-источник> <json> [--profile default] [--check]
 *   node scripts/import-tables.mjs --all [--check]
 *
 * Папка содержит файлы <РЕЖИМ>-<заряд>.txt (см. data-sources/README.md).
 * Скрипт заменяет profiles.<profile>.modes / columns / units в JSON,
 * остальные поля справочника не трогает.
 *
 * --all — все папки data-sources/<id> → src/data/artillery/<id>.json.
 * --check — ничего не записывать, а только сравнить: код выхода 1,
 * если JSON не совпадает с текстовыми источниками.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_COLUMNS = ['range', 'elevation', 'dElevPer100m', 'dTofPer100m', 'tof']
const WEATHER_COLUMNS = [
  'azimuthPerCrosswind',
  'rangePerHeadwind',
  'rangePerTailwind',
  'rangePerTempDec',
  'rangePerTempInc',
  'rangePerDensityDec',
  'rangePerDensityInc',
]
const UNITS = {
  range: 'm',
  elevation: 'mil',
  dElevPer100m: 'mil',
  dTofPer100m: 's',
  tof: 's',
  azimuthPerCrosswind: 'mil per 1 m/s',
  rangePerHeadwind: 'm per 1 m/s',
  rangePerTailwind: 'm per 1 m/s',
  rangePerTempDec: 'm per 1 °C',
  rangePerTempInc: 'm per 1 °C',
  rangePerDensityDec: 'm per 1 %',
  rangePerDensityInc: 'm per 1 %',
}
const FILE_RE = /^(HIGH|LOW)-(\d+)\.txt$/

function fail(message) {
  console.error(`import-tables: ${message}`)
  process.exit(1)
}

function parseValue(token, where, column) {
  if (token === '-') {
    // Прочерк допустим везде, кроме дальности, возвышения и времени полёта.
    if (column === 0 || column === 1 || column === 4) {
      fail(`${where}: прочерк в обязательном столбце ${column + 1}`)
    }
    return null
  }
  const value = Number(token)
  if (!Number.isFinite(value)) fail(`${where}: не число «${token}»`)
  // «-0.0» из игры → 0
  return value === 0 ? 0 : value
}

function parseTable(path) {
  const rows = []
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)

  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) return

    const where = `${path}:${index + 1}`
    const tokens = line.split(/\s+/)
    if (tokens.length !== 5 && tokens.length !== 12) {
      fail(`${where}: ожидалось 5 или 12 столбцов, найдено ${tokens.length}`)
    }

    const row = tokens.map((token, column) => parseValue(token, where, column))
    const previous = rows[rows.length - 1]

    if (previous) {
      if (row[0] <= previous[0]) fail(`${where}: дальность не возрастает`)
      if (row.length !== previous.length) {
        fail(`${where}: разное число столбцов в одной таблице`)
      }
    }
    rows.push(row)
  })

  if (rows.length === 0) fail(`${path}: пустая таблица`)
  return rows
}

function readSources(dir) {
  const modes = {}
  let width = 5

  const files = readdirSync(dir)
    .map((name) => ({ name, match: FILE_RE.exec(name) }))
    .filter(({ match }) => match !== null)
    .sort((a, b) =>
      a.match[1] === b.match[1]
        ? Number(a.match[2]) - Number(b.match[2])
        : a.match[1] < b.match[1] ? -1 : 1
    )

  if (files.length === 0) fail(`${dir}: нет файлов <РЕЖИМ>-<заряд>.txt`)

  for (const { name, match } of files) {
    const [, mode, charge] = match
    const rows = parseTable(join(dir, name))
    width = Math.max(width, rows[0].length)
    modes[mode] ??= {}
    modes[mode][String(Number(charge))] = rows
  }

  return { modes, width }
}

/** JSON с отступом 2, но массивы примитивов — в одну строку. */
function serialize(value, indent = '') {
  const inner = `${indent}  `

  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== 'object')) {
      return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`
    }
    return `[\n${value
      .map((item) => inner + serialize(item, inner))
      .join(',\n')}\n${indent}]`
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    return `{\n${entries
      .map(([key, item]) => `${inner}${JSON.stringify(key)}: ${serialize(item, inner)}`)
      .join(',\n')}\n${indent}}`
  }

  return JSON.stringify(value)
}

function importOne(sourceDir, jsonPath, profileKey, check) {
  const { modes, width } = readSources(sourceDir)

  const original = readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(original)
  data.profiles ??= {}

  const columns =
    width === 12 ? [...BASE_COLUMNS, ...WEATHER_COLUMNS] : BASE_COLUMNS
  const previous = data.profiles[profileKey] ?? {}

  data.profiles[profileKey] = {
    columns,
    units: Object.fromEntries(columns.map((c) => [c, UNITS[c]])),
    ...(previous.notes !== undefined ? { notes: previous.notes } : {}),
    modes,
  }

  const output = `${serialize(data)}\n`
  const normalized = original.replace(/\r\n/g, '\n')

  if (check) {
    if (output !== normalized) {
      fail(`${jsonPath} не совпадает с ${sourceDir}. Запустите без --check.`)
    }
    console.log(`ok  ${jsonPath}`)
    return
  }

  writeFileSync(jsonPath, output)
  const charges = Object.entries(modes)
    .map(([mode, tables]) => `${mode}: ${Object.keys(tables).join(', ')}`)
    .join('; ')
  console.log(`записано ${jsonPath} (${charges})`)
}

const args = process.argv.slice(2)
const check = args.includes('--check')
const all = args.includes('--all')
const profileIndex = args.indexOf('--profile')
const profileKey = profileIndex >= 0 ? args[profileIndex + 1] : 'default'
const positional = args.filter(
  (arg, i) =>
    !arg.startsWith('--') && (profileIndex < 0 || i !== profileIndex + 1)
)

if (all) {
  // Каждая папка data-sources/<id> ↔ src/data/artillery/<id>.json
  const root = 'data-sources'
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    importOne(
      join(root, entry.name),
      join('src', 'data', 'artillery', `${entry.name}.json`),
      'default',
      check
    )
  }
} else {
  if (positional.length !== 2 || !profileKey) {
    fail(
      'использование: import-tables.mjs <папка> <json> [--profile <ключ>] [--check] | --all [--check]'
    )
  }
  importOne(positional[0], positional[1], profileKey, check)
}

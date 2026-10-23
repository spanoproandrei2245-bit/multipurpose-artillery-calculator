#!/usr/bin/env node
/**
 * Приём таблиц, перепечатанных любой нейросетью (или руками), и их проверка.
 *
 *   node scripts/ingest-tables.mjs split <id> <файл-с-ответом> [--advanced] [--dry]
 *       Разрезает ответ нейросети по заголовкам «### HIGH-3» на файлы
 *       data-sources/<id>[/advanced]/HIGH-3.txt. Кодовые ограждения ``` убираются.
 *
 *   node scripts/ingest-tables.mjs validate <id> [--advanced]
 *       Проверяет все файлы папки и печатает ВСЕ найденные проблемы
 *       (а не только первую): число столбцов, порядок дальности, знаки,
 *       «?» вместо нечитаемых цифр, подозрительные скачки возвышения/времени.
 *
 * После этого: npm run tables:import && npm run tables:check && npm test.
 * Формат файлов — data-sources/README.md, инструкция для нейросети —
 * data-sources/AI-IMPORT.md.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE_RE = /^(HIGH|LOW)-(\d+)\.txt$/
const args = process.argv.slice(2)
const command = args[0]
const flags = new Set(args.filter((a) => a.startsWith('--')))
const positional = args.slice(1).filter((a) => !a.startsWith('--'))

function fail(message) {
  console.error(`ingest-tables: ${message}`)
  process.exit(1)
}

function sourceDir(id) {
  const dir = join('data-sources', id)
  return flags.has('--advanced') ? join(dir, 'advanced') : dir
}

// ---- split ----

function split(id, file) {
  if (!id || !file) fail('использование: split <id> <файл> [--advanced] [--dry]')
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const sections = new Map()
  let current = null
  for (const line of text.split('\n')) {
    const header = /^(?:#{1,4}|={2,})\s*(HIGH|LOW)\s*[-– ]\s*(\d+)\b/i.exec(line.trim())
    if (header) {
      current = `${header[1].toUpperCase()}-${Number(header[2])}`
      if (sections.has(current)) fail(`заголовок ${current} встречается дважды`)
      sections.set(current, [])
      continue
    }
    if (current === null) continue
    if (line.trim().startsWith('```')) continue
    sections.get(current).push(line)
  }
  if (sections.size === 0) fail('не найдено ни одного заголовка вида «### HIGH-3»')

  const dir = sourceDir(id)
  if (!flags.has('--dry')) mkdirSync(dir, { recursive: true })
  for (const [name, lines] of sections) {
    const body = lines.join('\n').trim()
    const path = join(dir, `${name}.txt`)
    const rows = body.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length
    console.log(`${flags.has('--dry') ? 'было бы записано' : 'записано'} ${path} (${rows} строк)`)
    if (!flags.has('--dry')) writeFileSync(path, `${body}\n`)
  }
}

// ---- validate ----

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function validateFile(path, problems, warnings) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const rows = []
  const add = (line, text) => problems.push(`${path}:${line}: ${text}`)

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) return
    const tokens = line.split(/\s+/)
    if (tokens.length !== 5 && tokens.length !== 12) {
      add(i + 1, `столбцов ${tokens.length}, нужно 5 или 12`)
      return
    }
    const values = tokens.map((token, c) => {
      if (token === '?' || /\?/.test(token)) {
        add(i + 1, `нечитаемое значение «${token}» в столбце ${c + 1} — посмотрите скриншот`)
        return NaN
      }
      if (token === '-') {
        if (c === 0 || c === 1 || c === 4) add(i + 1, `прочерк в обязательном столбце ${c + 1}`)
        return null
      }
      const n = Number(token.replace(',', '.'))
      if (!Number.isFinite(n)) add(i + 1, `не число «${token}» (столбец ${c + 1})`)
      return n
    })
    rows.push({ line: i + 1, values, width: tokens.length })
  })

  if (rows.length === 0) {
    problems.push(`${path}: пустая таблица`)
    return 0
  }

  const width = rows[0].width
  for (const row of rows) {
    if (row.width !== width) add(row.line, 'число столбцов отличается от первой строки')
  }
  // Дальность растёт, шаг одинаковый
  const steps = []
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].values[0]
    const b = rows[i].values[0]
    if (!(b > a)) add(rows[i].line, `дальность не растёт: ${a} → ${b}`)
    else steps.push(b - a)
  }
  const step = median(steps)
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].values[0] - rows[i - 1].values[0]
    if (d > 0 && step > 0 && d !== step) {
      warnings.push(`${path}:${rows[i].line}: шаг дальности ${d} вместо обычного ${step} — пропущена или лишняя строка?`)
    }
  }
  // Подозрительные скачки возвышения и времени полёта (ошибка распознавания цифры)
  for (const [col, name, factor] of [[1, 'возвышение', 4], [4, 'время полёта', 4]]) {
    const diffs = []
    for (let i = 1; i < rows.length; i++) diffs.push(rows[i].values[col] - rows[i - 1].values[col])
    const typical = median(diffs.map(Math.abs)) || 1
    diffs.forEach((d, i) => {
      if (Number.isFinite(d) && Math.abs(d) > typical * factor + 3) {
        warnings.push(`${path}:${rows[i + 1].line}: скачок: ${name} ${rows[i].values[col]} → ${rows[i + 1].values[col]} (обычно ~${typical.toFixed(1)}) — проверьте цифры`)
      }
    })
  }
  return rows.length
}

function validate(id) {
  if (!id) fail('использование: validate <id> [--advanced]')
  const dir = sourceDir(id)
  if (!existsSync(dir)) fail(`нет папки ${dir}`)
  const files = readdirSync(dir).filter((n) => FILE_RE.test(n)).sort()
  if (files.length === 0) fail(`${dir}: нет файлов HIGH-n.txt / LOW-n.txt`)
  const problems = []
  const warnings = []
  let total = 0
  for (const name of files) total += validateFile(join(dir, name), problems, warnings)
  console.log(`${files.length} файлов, ${total} строк`)
  if (warnings.length > 0) {
    console.log(`
Предупреждения (сверьте со скриншотом, в играх бывают переменный шаг и обрыв таблицы): ${warnings.length}`)
    for (const w of warnings) console.log(`  ${w}`)
  }
  if (problems.length > 0) {
    console.log(`\nПроблем: ${problems.length}`)
    for (const p of problems) console.log(`  ${p}`)
    process.exit(1)
  }
  console.log('Проблем не найдено. Дальше: npm run tables:import && npm run tables:check && npm test')
}

if (command === 'split') split(positional[0], positional[1])
else if (command === 'validate') validate(positional[0])
else fail('команды: split | validate')

#!/usr/bin/env node
/**
 * Мост с запущенной игрой (tools/arma/bridge_bootstrap.sqf): команды кладутся файлами
 * в <Arma 3>\gradbridge\, игра их выполняет и пишет результат в RPT.
 *
 *   node scripts/arma-bridge.mjs init                 — создать папку моста
 *   node scripts/arma-bridge.mjs send <файл.sqf> [--timeout 120]
 *                                                     — выполнить код в игре, дождаться результата
 *   node scripts/arma-bridge.mjs snap <файл.png>      — снимок экрана (игра должна быть на переднем плане)
 *
 * Папка игры — переменная ARMA_DIR (по умолчанию D:/Gaming/Steam/steamapps/common/Arma 3).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, closeSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ARMA = process.env.ARMA_DIR ?? 'D:/Gaming/Steam/steamapps/common/Arma 3'
const DIR = join(ARMA, 'gradbridge')
const RPT_DIR = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Arma 3')

const [command, arg] = process.argv.slice(2)
const timeoutIndex = process.argv.indexOf('--timeout')
const timeoutS = timeoutIndex > 0 ? Number(process.argv[timeoutIndex + 1]) : 120

function latestRpt() {
  const files = readdirSync(RPT_DIR)
    .filter((f) => f.toLowerCase().endsWith('.rpt'))
    .map((f) => ({ f: join(RPT_DIR, f), t: statSync(join(RPT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  return files[0]?.f
}

function readFrom(file, offset) {
  const size = statSync(file).size
  if (size <= offset) return { text: '', size }
  const fd = openSync(file, 'r')
  const buf = Buffer.alloc(size - offset)
  readSync(fd, buf, 0, buf.length, offset)
  closeSync(fd)
  return { text: buf.toString('utf8'), size }
}

function lastCmd() {
  let n = 0
  while (existsSync(join(DIR, `cmd_${n + 1}.sqf`))) n += 1
  return n
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (command === 'init') {
  mkdirSync(DIR, { recursive: true })
  // Метка папки: игра ищет её через fileExists. Прочитанные файлы игра держит открытыми,
  // поэтому каждая команда — новый файл cmd_<n>.sqf, старые не перезаписываются
  if (!existsSync(join(DIR, 'bridge.txt'))) writeFileSync(join(DIR, 'bridge.txt'), 'gradbridge')
  console.log(`мост: ${DIR}, последняя команда: ${lastCmd()}`)
} else if (command === 'send') {
  const code = readFileSync(arg, 'utf8')
  const n = lastCmd() + 1
  const rpt = latestRpt()
  let offset = statSync(rpt).size
  writeFileSync(join(DIR, `cmd_${n}.sqf`), code)
  console.log(`→ команда ${n} (${rpt})`)
  const started = Date.now()
  let done = false
  while (!done && Date.now() - started < timeoutS * 1000) {
    await sleep(300)
    const { text, size } = readFrom(rpt, offset)
    offset = size
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue
      if (/GRADBRIDGE\||GRADSAT\||Error|error|Warning Message/.test(line)) console.log(line.trim())
      if (line.includes(`GRADBRIDGE|done|${n}|`)) done = true
    }
  }
  if (!done) {
    console.log(`нет ответа за ${timeoutS} с — игра на паузе, мост не запущен или команда ещё идёт`)
    process.exit(2)
  }
} else if (command === 'snap') {
  const ps1 = fileURLToPath(new URL('../tools/arma/snap.ps1', import.meta.url))
  console.log(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Out', arg]).toString().trim())
} else {
  console.error('команды: init | send <файл.sqf> | snap <файл.png>')
  process.exit(1)
}

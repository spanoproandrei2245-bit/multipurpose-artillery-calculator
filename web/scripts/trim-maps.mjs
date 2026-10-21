#!/usr/bin/env node
/**
 * Уменьшает вес встроенных карт: убирает самый подробный уровень тайлов
 * у карт, где он тяжелее порога (по умолчанию 3 МБ). Детализация падает
 * вдвое (около 4 м на пиксель), для наведения этого достаточно.
 *
 *   node scripts/trim-maps.mjs [порог, МБ]
 */
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../public/maps/', import.meta.url))
const limitMb = Number(process.argv[2] ?? 3)

function sizeMb(dir) {
  let total = 0
  for (const name of readdirSync(dir)) {
    const stat = statSync(join(dir, name))
    total += stat.isDirectory() ? sizeMb(join(dir, name)) * 1024 * 1024 : stat.size
  }
  return total / 1024 / 1024
}

let saved = 0
for (const world of readdirSync(ROOT)) {
  const mapFile = join(ROOT, world, 'map.json')
  try {
    statSync(mapFile)
  } catch {
    continue
  }
  const map = JSON.parse(readFileSync(mapFile, 'utf8'))
  const top = map.tiles.levels - 1
  const topDir = join(ROOT, world, 'tiles', String(top))
  if (top < 1) continue
  const mb = sizeMb(topDir)
  if (mb <= limitMb) continue
  rmSync(topDir, { recursive: true, force: true })
  map.tiles.levels -= 1
  map.tiles.metersPerTile *= 2
  writeFileSync(mapFile, JSON.stringify(map, null, 2) + '\n')
  saved += mb
  console.log(`${world}: уровень ${top} (${mb.toFixed(1)} МБ) убран`)
}
console.log(`Освобождено ${saved.toFixed(1)} МБ`)

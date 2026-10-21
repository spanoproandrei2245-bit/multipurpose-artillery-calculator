#!/usr/bin/env node
/**
 * Превью карт для списков (preview.webp, 192 px): вырезка из тайла
 * самого грубого уровня — без пустых полей вокруг карты.
 *
 *   node scripts/make-map-previews.mjs [карта…]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = fileURLToPath(new URL('../public/maps/', import.meta.url))
const only = process.argv.slice(2)

export async function makePreview(world) {
  const dir = join(ROOT, world)
  const map = JSON.parse(readFileSync(join(dir, 'map.json'), 'utf8'))
  const { size, levels, metersPerTile, ext } = map.tiles
  // Тайл 0 покрывает metersPerTile · 2^(levels-1) м; карта занимает его левый верхний угол
  const cover = metersPerTile * 2 ** (levels - 1)
  const side = Math.max(1, Math.min(size, Math.round((map.worldSize / cover) * size)))
  await sharp(join(dir, 'tiles', '0', `0_0.${ext}`))
    .extract({ left: 0, top: 0, width: side, height: side })
    .resize(192, 192)
    .webp({ quality: 70 })
    .toFile(join(dir, 'preview.webp'))
  return side
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const world of readdirSync(ROOT)) {
    if (only.length && !only.includes(world)) continue
    if (!existsSync(join(ROOT, world, 'map.json'))) continue
    const side = await makePreview(world)
    console.log(`${world}: preview.webp (${side} px из тайла)`)
  }
}

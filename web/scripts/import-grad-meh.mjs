#!/usr/bin/env node
/**
 * Встроенные карты из выгрузки мода grad_meh (Gruppe Adler Map Exporter).
 *
 *   node scripts/import-grad-meh.mjs "<Arma 3>/grad_meh/stratis" [ещё папки…]
 *
 * Из папки карты берутся:
 *   sat/<столбец>/<строка>.png — спутниковый снимок (сетка тайлов, север сверху);
 *   dem.asc.gz                 — высоты (ESRI ASCII Grid);
 *   meta.json                  — название, размер карты.
 * В web/public/maps/<карта>/ пишутся:
 *   tiles/<z>/<x>_<y>.webp — пирамида тайлов 512 px (z = 0 — вся карта одним тайлом);
 *   heights.bin            — высоты, Int16 в дециметрах, строки с юга на север;
 *   map.json               — описание карты для приложения.
 * И общий список web/public/maps/index.json.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import { makePreview } from './make-map-previews.mjs'

const TILE = 512
// Детализация верхнего уровня — не мельче этого, м на пиксель
const TARGET_METERS_PER_PIXEL = 2
// Шаг сетки высот — около этого, м (кратно шагу исходной сетки)
const TARGET_HEIGHT_STEP = 20
const QUALITY = 70

const OUT_ROOT = new URL('../public/maps/', import.meta.url)

function hex(rgba) {
  return `#${rgba
    .slice(0, 3)
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

// ---- спутниковый снимок → пирамида тайлов ----

async function buildTiles(source, outDir, worldSize, background) {
  const columns = readdirSync(join(source, 'sat'))
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .sort((a, b) => a - b)
  const n = columns.length
  const sourceMeters = worldSize / n
  // Сколько выходных тайлов на один исходный по стороне
  // Огромные карты (Беккетов, Алтис) грубее: иначе тайлы весят десятки МБ
  const mpp = Math.max(TARGET_METERS_PER_PIXEL, worldSize / 6144)
  const perSource = Math.ceil(sourceMeters / (TILE * mpp))
  const maxCols = n * perSource
  const levels = Math.ceil(Math.log2(maxCols)) + 1
  const top = levels - 1

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(join(outDir, String(top)), { recursive: true })

  // Верхний уровень: каждый исходный тайл уменьшаем один раз и режем
  for (const a of columns) {
    for (let b = 0; b < n; b += 1) {
      const file = join(source, 'sat', String(a), `${b}.png`)
      const { data, info } = await sharp(file)
        .removeAlpha()
        .resize(perSource * TILE, perSource * TILE)
        .raw()
        .toBuffer({ resolveWithObject: true })
      for (let tx = 0; tx < perSource; tx += 1) {
        for (let ty = 0; ty < perSource; ty += 1) {
          // Только размеры: флаг premultiplied из info портит цвета
          await sharp(data, {
            raw: { width: info.width, height: info.height, channels: info.channels },
          })
            .extract({ left: tx * TILE, top: ty * TILE, width: TILE, height: TILE })
            .webp({ quality: QUALITY })
            .toFile(join(outDir, String(top), `${a * perSource + tx}_${b * perSource + ty}.webp`))
        }
      }
      process.stdout.write('.')
    }
  }

  // Уровни ниже: четыре соседних тайла → один
  let cols = maxCols
  for (let z = top - 1; z >= 0; z -= 1) {
    const childCols = cols
    cols = Math.ceil(cols / 2)
    mkdirSync(join(outDir, String(z)), { recursive: true })
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < cols; y += 1) {
        const parts = []
        for (let dx = 0; dx < 2; dx += 1) {
          for (let dy = 0; dy < 2; dy += 1) {
            const cx = x * 2 + dx
            const cy = y * 2 + dy
            if (cx >= childCols || cy >= childCols) continue
            parts.push({
              input: join(outDir, String(z + 1), `${cx}_${cy}.webp`),
              left: dx * TILE,
              top: dy * TILE,
            })
          }
        }
        const merged = await sharp({
          create: { width: TILE * 2, height: TILE * 2, channels: 3, background },
        })
          .composite(parts)
          .png()
          .toBuffer()
        await sharp(merged)
          .resize(TILE, TILE)
          .webp({ quality: QUALITY })
          .toFile(join(outDir, String(z), `${x}_${y}.webp`))
      }
    }
  }
  process.stdout.write('\n')

  return {
    size: TILE,
    levels,
    // Метров на тайл верхнего уровня
    metersPerTile: worldSize / maxCols,
    ext: 'webp',
  }
}

// ---- высоты: ESRI ASCII Grid → Int16, дециметры ----

function buildHeights(source, outFile) {
  const text = gunzipSync(readFileSync(join(source, 'dem.asc.gz'))).toString('latin1')
  const lines = text.split('\n')
  const header = {}
  let row0 = 0
  for (; row0 < lines.length; row0 += 1) {
    const match = lines[row0].trim().match(/^([a-zA-Z_]+)\s+(-?[\d.]+)$/)
    if (!match) break
    header[match[1].toLowerCase()] = Number(match[2])
  }
  const { ncols, nrows, cellsize } = header
  const k = Math.max(1, Math.round(TARGET_HEIGHT_STEP / cellsize))
  const step = cellsize * k
  const size = Math.floor((Math.min(ncols, nrows) - 1) / k) + 1
  const heights = new Int16Array(size * size)

  // Строка 0 файла — север; в приложении строка 0 — юг
  for (let j = 0; j < size; j += 1) {
    const values = lines[row0 + (nrows - 1 - j * k)].trim().split(/\s+/)
    for (let i = 0; i < size; i += 1) {
      const h = Number(values[i * k])
      heights[j * size + i] = Math.max(-32768, Math.min(32767, Math.round(h * 10)))
    }
  }
  writeFileSync(outFile, Buffer.from(heights.buffer))
  return { file: 'heights.bin', step, size, scale: 0.1 }
}

// ---- одна карта ----

async function importMap(source) {
  const meta = JSON.parse(readFileSync(join(source, 'meta.json'), 'utf8'))
  const world = String(meta.worldName).toLowerCase()
  const worldSize = Number(meta.worldSize)
  const background = hex(meta.colorOutside ?? [0.3, 0.33, 0.37, 1])
  const outDir = new URL(`./${world}/`, OUT_ROOT)
  mkdirSync(outDir, { recursive: true })

  console.log(`${world}: ${meta.displayName}, ${worldSize} m`)
  const heights = buildHeights(source, new URL('heights.bin', outDir))
  console.log(`  heights: ${heights.size}×${heights.size}, step ${heights.step} m`)
  const tiles = await buildTiles(source, fileURLToPath(new URL('tiles', outDir)), worldSize, background)
  console.log(`  tiles: ${tiles.levels} levels, ${tiles.metersPerTile.toFixed(1)} m per top tile`)

  const map = {
    format: 'arma-map',
    version: 1,
    world,
    displayName: meta.displayName ?? world,
    author: meta.author ?? '',
    worldSize,
    background,
    heights,
    tiles,
  }
  writeFileSync(new URL('map.json', outDir), JSON.stringify(map, null, 2) + '\n')
  // Превью для списков карт
  await makePreview(world)
  // Официальные карты — от Bohemia Interactive, остальные — от сообщества
  const kind = /bohemia/i.test(map.author) ? 'official' : 'community'
  return { world, displayName: map.displayName, author: map.author, kind, worldSize }
}

// ---- список карт ----

const sources = process.argv.slice(2)
if (sources.length === 0) {
  console.error('usage: node scripts/import-grad-meh.mjs <grad_meh map folder>...')
  process.exit(1)
}

const indexFile = new URL('index.json', OUT_ROOT)
mkdirSync(OUT_ROOT, { recursive: true })
const index = existsSync(indexFile)
  ? JSON.parse(readFileSync(indexFile, 'utf8'))
  : { maps: [] }

for (const source of sources) {
  const entry = await importMap(source)
  // Русское название задаётся в index.json руками — не затираем
  const previous = index.maps.find((m) => m.world === entry.world)
  if (previous?.nameRu) entry.nameRu = previous.nameRu
  index.maps = [...index.maps.filter((m) => m.world !== entry.world), entry].sort(
    (a, b) => a.displayName.localeCompare(b.displayName)
  )
}
writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n')
console.log(`maps: ${index.maps.map((m) => m.world).join(', ')}`)

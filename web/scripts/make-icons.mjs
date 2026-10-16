#!/usr/bin/env node
/**
 * Иконки приложения (PWA и favicon) без внешних зависимостей:
 * силуэт миномёта из ArtilleryIcon, отрисованный в PNG вручную.
 *
 *   node scripts/make-icons.mjs
 *
 * Результат — в public/: icon-192.png, icon-512.png,
 * icon-maskable-512.png, favicon.svg.
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BACKGROUND = [10, 10, 10] // фон тёмной темы
const STROKE = [255, 90, 31] // акцент

// Линии значка в сетке 24×24 (как в ArtilleryIcon, категория mortar)
const SEGMENTS = [
  // ствол (контур)
  [6.6, 17.6, 15.4, 5.4],
  [15.4, 5.4, 17.4, 6.8],
  [17.4, 6.8, 8.6, 19],
  [8.6, 19, 6.6, 17.6],
  // двунога
  [13.6, 10.4, 10.5, 19.5],
  [13.6, 10.4, 18, 19.5],
  // опорная плита
  [4, 19.5, 11, 19.5],
]
const GLYPH_CENTER = [11, 12.45]
const GLYPH_HEIGHT = 14.1
const STROKE_WIDTH = 1.5

function distanceToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  )
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * size — сторона, px; glyphShare — доля высоты под значок;
 * radius — скругление фона в долях стороны (0 — квадрат на всю площадь).
 */
function render(size, glyphShare, radius) {
  const scale = (size * glyphShare) / GLYPH_HEIGHT
  const halfWidth = (STROKE_WIDTH * scale) / 2
  const r = radius * size
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cx = x + 0.5
      const cy = y + 0.5

      // Фон: скруглённый квадрат со сглаживанием краёв
      let background = 1
      if (r > 0) {
        const qx = Math.max(r - cx, cx - (size - r), 0)
        const qy = Math.max(r - cy, cy - (size - r), 0)
        background = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(qx, qy)))
      }

      // Значок: расстояние до ближайшей линии в координатах сетки
      const gx = (cx - size / 2) / scale + GLYPH_CENTER[0]
      const gy = (cy - size / 2) / scale + GLYPH_CENTER[1]
      let d = Infinity
      for (const segment of SEGMENTS) {
        d = Math.min(d, distanceToSegment(gx, gy, segment))
      }
      const ink = Math.max(0, Math.min(1, halfWidth + 0.5 - d * scale))

      const i = (y * size + x) * 4
      for (let c = 0; c < 3; c += 1) {
        pixels[i + c] = Math.round(
          BACKGROUND[c] * (1 - ink) + STROKE[c] * ink
        )
      }
      pixels[i + 3] = Math.round(255 * background)
    }
  }

  return encodePng(size, pixels)
}

// ---- PNG ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // бит на канал
  header[9] = 6 // RGBA

  // Каждая строка начинается с байта фильтра (0 — без фильтра)
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- SVG ----

function svg() {
  const scale = (24 * 0.62) / GLYPH_HEIGHT
  const tx = 12 - GLYPH_CENTER[0] * scale
  const ty = 12 - GLYPH_CENTER[1] * scale
  const lines = SEGMENTS.map(
    ([x1, y1, x2, y2]) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
  ).join('')
  const hex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="1.5" fill="${hex(BACKGROUND)}"/><g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(4)})" stroke="${hex(STROKE)}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${lines}</g></svg>\n`
}

const out = new URL('../public/', import.meta.url)
writeFileSync(new URL('icon-192.png', out), render(192, 0.62, 0.06))
writeFileSync(new URL('icon-512.png', out), render(512, 0.62, 0.06))
// Maskable: фон на всю площадь, значок в безопасной зоне (центр 80 %)
writeFileSync(new URL('icon-maskable-512.png', out), render(512, 0.5, 0))
writeFileSync(new URL('favicon.svg', out), svg())
console.log('icons written to public/')

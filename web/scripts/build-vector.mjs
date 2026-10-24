/**
 * Векторный слой карты из выгрузки grad_meh (geojson/*.geojson.gz + dem.asc.gz):
 * здания, дороги, леса, названия, отметки высот и горизонтали.
 * Результат — компактный vector.json (координаты целыми в половинах метра,
 * внутри линии — разности соседних точек).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

// Единиц координаты на метр: 2 → точность 0,5 м
const Q = 2
const CONTOUR_STEP = 10 // м по высоте
const CONTOUR_GRID = 20 // м между узлами сетки для горизонталей
const SIMPLIFY = 1.5 // м, упрощение линий
const MIN_HOUSE_AREA = 4 // м², мельче — не здание

function readLayer(dir, name) {
  const file = join(dir, `${name}.geojson.gz`)
  if (!existsSync(file)) return []
  const data = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'))
  return Array.isArray(data) ? data : (data.features ?? [])
}

/** Дельта-кодирование: первая точка целиком, дальше разности. */
function encodePath(points, simplifyTol = 0) {
  const pts = simplifyTol > 0 ? douglasPeucker(points, simplifyTol) : points
  const out = []
  let px = 0
  let py = 0
  pts.forEach(([x, y], i) => {
    const qx = Math.round(x * Q)
    const qy = Math.round(y * Q)
    if (i === 0) out.push(qx, qy)
    else out.push(qx - px, qy - py)
    px = qx
    py = qy
  })
  return out
}

function douglasPeucker(points, tol) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let max = 0
    let idx = -1
    const [ax, ay] = points[a]
    const [bx, by] = points[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    for (let i = a + 1; i < b; i += 1) {
      const d = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / len
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

function ringArea(ring) {
  let s = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    s += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(s / 2)
}

// ---- горизонтали: marching squares по DEM ----

function readDem(source) {
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
  const k = Math.max(1, Math.round(CONTOUR_GRID / cellsize))
  const step = cellsize * k
  const size = Math.floor((Math.min(ncols, nrows) - 1) / k) + 1
  const grid = new Float32Array(size * size)
  // Строка 0 сетки — юг
  for (let j = 0; j < size; j += 1) {
    const values = lines[row0 + (nrows - 1 - j * k)].trim().split(/\s+/)
    for (let i = 0; i < size; i += 1) grid[j * size + i] = Number(values[i * k])
  }
  return { grid, size, step }
}

function contourLines({ grid, size, step }) {
  const result = []
  let min = Infinity
  let max = -Infinity
  for (const h of grid) {
    if (h < min) min = h
    if (h > max) max = h
  }
  const at = (i, j) => grid[j * size + i]
  for (let level = Math.ceil(Math.max(min, 1) / CONTOUR_STEP) * CONTOUR_STEP; level <= max; level += CONTOUR_STEP) {
    // Отрезки; ключ узла — по середине ребра
    const segments = []
    const edge = (i, j, dir) => {
      // dir 0: ребро (i,j)-(i+1,j); dir 1: (i,j)-(i,j+1)
      const a = at(i, j)
      const b = dir === 0 ? at(i + 1, j) : at(i, j + 1)
      const t = (level - a) / (b - a)
      return dir === 0
        ? { key: `h${i},${j}`, x: (i + t) * step, y: j * step }
        : { key: `v${i},${j}`, x: i * step, y: (j + t) * step }
    }
    for (let j = 0; j < size - 1; j += 1) {
      for (let i = 0; i < size - 1; i += 1) {
        const v00 = at(i, j) >= level
        const v10 = at(i + 1, j) >= level
        const v11 = at(i + 1, j + 1) >= level
        const v01 = at(i, j + 1) >= level
        const code = (v00 ? 1 : 0) | (v10 ? 2 : 0) | (v11 ? 4 : 0) | (v01 ? 8 : 0)
        if (code === 0 || code === 15) continue
        const bottom = () => edge(i, j, 0)
        const top = () => edge(i, j + 1, 0)
        const left = () => edge(i, j, 1)
        const right = () => edge(i + 1, j, 1)
        const pairs = {
          1: [[left, bottom]], 14: [[left, bottom]],
          2: [[bottom, right]], 13: [[bottom, right]],
          3: [[left, right]], 12: [[left, right]],
          4: [[right, top]], 11: [[right, top]],
          6: [[bottom, top]], 9: [[bottom, top]],
          7: [[left, top]], 8: [[left, top]],
          5: [[left, top], [bottom, right]],
          10: [[left, bottom], [top, right]],
        }[code]
        for (const [p, q] of pairs) segments.push([p(), q()])
      }
    }
    // Склейка отрезков в ломаные
    const byKey = new Map()
    segments.forEach((s, idx) => {
      for (const p of s) {
        if (!byKey.has(p.key)) byKey.set(p.key, [])
        byKey.get(p.key).push(idx)
      }
    })
    const used = new Uint8Array(segments.length)
    const take = (key) => {
      for (const idx of byKey.get(key) ?? []) if (!used[idx]) return idx
      return -1
    }
    for (let start = 0; start < segments.length; start += 1) {
      if (used[start]) continue
      used[start] = 1
      let [a, b] = segments[start]
      const line = [a, b]
      for (;;) {
        const next = take(line[line.length - 1].key)
        if (next < 0) break
        used[next] = 1
        const [p, q] = segments[next]
        line.push(p.key === line[line.length - 1].key ? q : p)
      }
      for (;;) {
        const next = take(line[0].key)
        if (next < 0) break
        used[next] = 1
        const [p, q] = segments[next]
        line.unshift(p.key === line[0].key ? q : p)
      }
      const pts = line.map((p) => [p.x, p.y])
      if (pts.length >= 3 || Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) > 5) {
        result.push([level, ...encodePath(pts, SIMPLIFY)])
      }
    }
  }
  return result
}

/** Высоты из уже импортированной карты (heights.bin), если в выгрузке нет dem. */
function readHeightsBin(mapDir) {
  const mapFile = join(mapDir, 'map.json')
  if (!existsSync(mapFile) || !existsSync(join(mapDir, 'heights.bin'))) return null
  const { heights } = JSON.parse(readFileSync(mapFile, 'utf8'))
  const raw = readFileSync(join(mapDir, 'heights.bin'))
  const ints = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2)
  const grid = new Float32Array(ints.length)
  for (let i = 0; i < ints.length; i += 1) grid[i] = ints[i] * heights.scale
  return { grid, size: heights.size, step: heights.step }
}

export function buildVector(source, outFile, mapDir = null) {
  const dir = join(source, 'geojson')
  if (!existsSync(dir)) return null

  const houses = []
  for (const f of readLayer(dir, 'house')) {
    const ring = f.geometry?.coordinates?.[0]
    if (!ring || ring.length < 4 || ringArea(ring) < MIN_HOUSE_AREA) continue
    houses.push(encodePath(ring.slice(0, -1)))
  }

  const forests = []
  for (const f of readLayer(dir, 'forest')) {
    const g = f.geometry
    const polys = g?.type === 'MultiPolygon' ? g.coordinates : g?.type === 'Polygon' ? [g.coordinates] : []
    for (const poly of polys) {
      if (poly[0] && poly[0].length >= 4) forests.push(encodePath(poly[0].slice(0, -1), SIMPLIFY))
    }
  }

  const runways = readLayer(dir, 'runway')
    .map((f) => f.geometry?.coordinates?.[0])
    .filter((r) => r && r.length >= 4)
    .map((r) => encodePath(r.slice(0, -1)))

  const roads = {}
  const roadsDir = join(dir, 'roads')
  if (existsSync(roadsDir)) {
    for (const name of readdirSync(roadsDir)) {
      const m = /^(main_road|road|track|trail)\.geojson\.gz$/.exec(name)
      if (!m) continue
      roads[m[1]] = readLayer(roadsDir, m[1]).map((f) => encodePath(f.geometry.coordinates, 1))
    }
  }

  const names = []
  const locDir = join(dir, 'locations')
  if (existsSync(locDir)) {
    for (const name of readdirSync(locDir)) {
      const type = name.replace('.geojson.gz', '')
      for (const f of readLayer(locDir, type)) {
        const n = f.properties?.name
        if (!n) continue
        const [x, y] = f.geometry.coordinates
        names.push([type, n, Math.round(x), Math.round(y)])
      }
    }
  }

  // Отметки высот: не чаще одной на ячейку 200 м (берём самую высокую)
  const spots = new Map()
  for (const f of readLayer(dir, 'mounts')) {
    const [x, y] = f.geometry.coordinates
    const key = `${Math.floor(x / 200)},${Math.floor(y / 200)}`
    const old = spots.get(key)
    if (!old || f.properties.elevation > old[2]) {
      spots.set(key, [Math.round(x), Math.round(y), Math.round(f.properties.elevation)])
    }
  }

  let contours = []
  if (existsSync(join(source, 'dem.asc.gz'))) contours = contourLines(readDem(source))
  else if (mapDir) {
    const dem = readHeightsBin(mapDir)
    if (dem) contours = contourLines(dem)
  }

  const vector = {
    version: 1,
    q: Q,
    contourStep: CONTOUR_STEP,
    houses,
    forests,
    runways,
    roads,
    names,
    spots: [...spots.values()],
    contours,
  }
  const json = JSON.stringify(vector)
  writeFileSync(outFile, json)
  return {
    file: 'vector.json',
    bytes: json.length,
    counts: {
      houses: houses.length,
      forests: forests.length,
      roads: Object.values(roads).reduce((n, r) => n + r.length, 0),
      names: names.length,
      spots: spots.size,
      contours: contours.length,
    },
  }
}

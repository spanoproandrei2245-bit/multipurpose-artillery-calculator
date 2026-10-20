import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import exportScript from '../data/export-heightmap.sqf?raw'
import {
  bearing,
  heightAt,
  isInside,
  mapExtent,
  parseHeightmap,
  toGridReference,
  type Heightmap,
  type MapPoint,
} from '../lib/heightmap'
import {
  aimPoints,
  DEFAULT_LINE_WEAPON,
  LINE_WEAPONS,
  polylineLength,
  type LineWeapon,
} from '../lib/fireLine'
import { parseGrid } from '../lib/grid'
import { readStoredText, writeStored } from '../lib/input'
import {
  addMarker,
  formatAge,
  MARKER_COLORS,
  MARKER_RGB,
  markerOpacity,
  removeMarker,
  useMarkers,
  type MapMarker,
  type MarkerColor,
} from '../lib/markers'
import { useSync } from '../lib/syncContext'
import type { MapTarget } from '../lib/journal'
import {
  deleteHeightmap,
  listHeightmaps,
  loadHeightmap,
  saveHeightmap,
  type StoredMapInfo,
} from '../lib/mapStore'
import { renderRelief, type ReliefPalette } from '../lib/relief'
import {
  listBuiltinMaps,
  loadBuiltinMap,
  mapKind,
  tileLevel,
  visibleTiles,
  type BuiltinMapEntry,
  type MapTiles,
} from '../lib/builtinMaps'
import { themeColor, useIsDark } from '../lib/useTheme'
import type { Language } from '../types/settings'
import { Dropdown } from './Dropdown'
import { FieldIcon, type FieldIconName } from './FieldIcon'
import { ScreenMarkers } from './ScreenMarkers'

export interface MapSelection {
  distance: number
  azimuthMil: number
  ownHeight: number
  targetHeight: number
  // Точка цели — сохраняется в журнал
  target: MapTarget
}

/** Цель из журнала, поставленная на карте. */
export interface JournalMapTarget {
  id: string
  name: string
  target: MapTarget
  // Цель, с которой сейчас работает калькулятор
  active: boolean
}

/** Сохранённая цель в быстром списке на карте. */
export interface QuickTarget {
  id: string
  name: string
  detail: string
  active: boolean
}

interface Props {
  language: Language
  onApply: (selection: MapSelection) => void
  // Цели журнала: показываются на карте, клик — загрузить цель
  journalTargets?: readonly JournalMapTarget[]
  onPickJournalTarget?: (id: string) => void
  // Точка текущей цели (например, загруженной из журнала)
  currentTarget?: MapTarget | null
  // Быстрый выбор сохранённых целей: список слева на карте
  quickTargets?: readonly QuickTarget[]
  // Орудие закреплено на карте (true) или освобождено (false); высота —
  // высота орудия в точке, м, если известна
  onGunLockChange?: (locked: boolean, height: number | null) => void
  // Метки на карте и распознавание меток с экрана игры — из настроек
  showMarkers?: boolean
  showScreenMarkers?: boolean
}

interface View {
  // Мировые координаты левого верхнего угла холста, м
  x0: number
  y0: number
  // Пикселей на метр
  scale: number
}

type Placing = 'gun' | 'target' | 'marker' | 'line'

// Клик ближе — попадание в метку, пиксели
const MARKER_HIT_PX = 14

const COLOR_NAMES: Record<MarkerColor, { ru: string; en: string }> = {
  red: { ru: 'красная', en: 'red' },
  orange: { ru: 'оранжевая', en: 'orange' },
  yellow: { ru: 'жёлтая', en: 'yellow' },
  green: { ru: 'зелёная', en: 'green' },
  blue: { ru: 'синяя', en: 'blue' },
  purple: { ru: 'фиолетовая', en: 'purple' },
  black: { ru: 'чёрная', en: 'black' },
}

function markerTitle(marker: MapMarker, ru: boolean): string {
  const color = ru ? COLOR_NAMES[marker.color].ru : COLOR_NAMES[marker.color].en
  return marker.label || `${ru ? 'Метка' : 'Marker'} (${color})`
}

const MAX_SCALE = 4
const GRID_SPACINGS = [100, 1000, 10000]

function readGun(world: string): MapPoint | null {
  try {
    const value = JSON.parse(readStoredText(`mapGun:${world}`)) as unknown
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as MapPoint).x === 'number' &&
      typeof (value as MapPoint).y === 'number'
    ) {
      return value as MapPoint
    }
  } catch {
    // Нет сохранённой позиции
  }
  return null
}

function readLine(world: string): MapPoint[] {
  try {
    const value = JSON.parse(readStoredText(`mapLine:${world}`)) as unknown
    if (Array.isArray(value)) {
      return value
        .filter(
          (p): p is MapPoint =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as MapPoint).x === 'number' &&
            typeof (p as MapPoint).y === 'number'
        )
        .slice(0, 50)
    }
  } catch {
    // Нет сохранённой линии
  }
  return []
}

function createReliefCanvas(
  map: Heightmap,
  palette: ReliefPalette
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = map.size
  canvas.height = map.size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const pixels = renderRelief(map, palette)
    ctx.putImageData(new ImageData(pixels, map.size, map.size), 0, 0)
  }
  return canvas
}

function fitView(map: Heightmap, width: number, height: number): View {
  const extent = mapExtent(map)
  const scale = Math.min(width, height) / extent
  return {
    scale,
    x0: extent / 2 - width / 2 / scale,
    y0: extent / 2 + height / 2 / scale,
  }
}

/**
 * Экспериментально: карта по сетке высот из игры. Клик ставит орудие
 * и цель — дистанция, азимут и высоты подставляются в калькулятор.
 */
export function MapPicker({
  language,
  onApply,
  journalTargets = [],
  onPickJournalTarget,
  currentTarget = null,
  showMarkers = false,
  showScreenMarkers = false,
  quickTargets = [],
  onGunLockChange,
}: Props) {
  const ru = language === 'ru'
  const unitM = ru ? 'м' : 'm'

  const [maps, setMaps] = useState<StoredMapInfo[]>([])
  // Встроенные карты (спутник + высоты) и тайлы открытой карты
  const [builtin, setBuiltin] = useState<BuiltinMapEntry[]>([])
  const [tiles, setTiles] = useState<MapTiles | null>(null)
  // Какой пункт списка открыт: «builtin:stratis» или «local:altis»
  const [mapKey, setMapKey] = useState('')
  const [map, setMap] = useState<Heightmap | null>(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [gun, setGun] = useState<MapPoint | null>(null)
  const [target, setTarget] = useState<MapPoint | null>(null)
  const [placing, setPlacing] = useState<Placing>('gun')

  // Орудие закреплено на карте: касания его не двигают
  const [gunLocked, setGunLocked] = useState(false)
  // Список целей слева: на узком экране свёрнут
  const [targetsOpen, setTargetsOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768
  )

  // Линия огня: ломаная из точек, оружие (радиус поражения) и номер
  // точки прицеливания, по которой стреляют сейчас
  const [linePoints, setLinePoints] = useState<MapPoint[]>([])
  const [lineWeaponId, setLineWeaponId] = useState<LineWeapon['id']>(() =>
    LINE_WEAPONS.find((w) => w.id === readStoredText('lineWeapon'))?.id ??
    DEFAULT_LINE_WEAPON
  )
  const lineWeapon =
    LINE_WEAPONS.find((w) => w.id === lineWeaponId) ?? LINE_WEAPONS[0]
  const [lineIndex, setLineIndex] = useState<number | null>(null)
  const lineAim = useMemo(
    () => aimPoints(linePoints, lineWeapon.radius),
    [linePoints, lineWeapon.radius]
  )

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View | null>(null)

  // Холст в состоянии: эффекты перезапускаются, когда он появляется
  // или пересоздаётся (после выбора карты, «Добавить карту»)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{
    x: number
    y: number
    view: View
    moved: boolean
  } | null>(null)

  const night = useIsDark()
  const relief = useMemo(
    () => (map ? createReliefCanvas(map, night ? 'night' : 'day') : null),
    [map, night]
  )

  // ---- метки ----
  const sync = useSync()
  const author =
    sync.callsign.trim() ||
    (sync.role === 'gunner'
      ? ru
        ? 'стрелок'
        : 'gunner'
      : ru
        ? 'наводчик'
        : 'FDC')
  const allMarkers = useMarkers()
  const markers = useMemo(
    () =>
      map && showMarkers
        ? allMarkers
            .filter((m) => m.world === map.world || m.world === '')
            .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [allMarkers, map, showMarkers]
  )
  // Новая метка: где поставлена и что вписать
  const [draft, setDraft] = useState<{
    point: MapPoint
    label: string
    color: MarkerColor
  } | null>(null)
  const [gridDraft, setGridDraft] = useState('')
  const [markerColor, setMarkerColor] = useState<MarkerColor>('red')

  // Часы для «сколько метке»
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(interval)
  }, [])

  function saveDraft() {
    if (!draft || !map) return
    addMarker({
      world: map.world,
      x: draft.point.x,
      y: draft.point.y,
      label: draft.label.trim(),
      color: draft.color,
      author,
      source: 'app',
    })
    setMarkerColor(draft.color)
    setDraft(null)
  }

  function addByGrid() {
    const point = parseGrid(gridDraft)
    if (!point || !map) return
    setDraft({ point: { x: point.x, y: point.y }, label: '', color: markerColor })
    setGridDraft('')
  }

  // ---- загрузка списка и последней карты ----
  function openMap(key: string) {
    const [source, world] = key.includes(':') ? key.split(':', 2) : ['local', key]
    const load =
      source === 'builtin'
        ? loadBuiltinMap(world).then((result) =>
            result ? { heightmap: result.heightmap, tiles: result.tiles } : null
          )
        : loadHeightmap(world).then((heightmap) =>
            heightmap ? { heightmap, tiles: null } : null
          )
    load
      .then((loaded) => {
        if (!loaded) return
        writeStored('mapWorld', key)
        setMapKey(key)
        setMap(loaded.heightmap)
        setTiles(loaded.tiles)
        setGun(readGun(world))
        setGunLocked(readStoredText(`mapGunLocked:${world}`) === 'on')
        setLinePoints(readLine(world))
        setLineIndex(null)
        setTarget(
          currentTarget?.world === world
            ? { x: currentTarget.x, y: currentTarget.y }
            : null
        )
        setPlacing('gun')
        setView(null)
        setAdding(false)
      })
      .catch(() =>
        setNotice(ru ? 'Не удалось открыть карту.' : 'Could not open the map.')
      )
  }

  useEffect(() => {
    void Promise.all([
      // IndexedDB недоступна — свои карты не сохраняются, встроенные есть
      listHeightmaps().catch(() => [] as StoredMapInfo[]),
      listBuiltinMaps(),
    ]).then(([local, embedded]) => {
      setMaps(local)
      setBuiltin(embedded)
      const keys = [
        ...embedded.map((m) => `builtin:${m.world}`),
        ...local.map((m) => `local:${m.world}`),
      ]
      const last = readStoredText('mapWorld')
      // Старые версии хранили просто имя мира
      const key =
        keys.find((k) => k === last) ??
        keys.find((k) => k === `local:${last}`) ??
        keys[0]
      if (key) openMap(key)
    })
    // Только при первом показе
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function importText(text: string) {
    const parsed = parseHeightmap(text)
    if (!parsed) {
      setNotice(
        ru
          ? 'Это не высоты из игры. Запустите скрипт ещё раз и вставьте результат.'
          : 'These are not heights from the game. Run the script again and paste the result.'
      )
      return
    }
    try {
      await saveHeightmap(parsed)
      setMaps(await listHeightmaps())
    } catch {
      // Сохранить не удалось — карта работает до перезагрузки
    }
    writeStored('mapWorld', `local:${parsed.world}`)
    setMapKey(`local:${parsed.world}`)
    setMap(parsed)
    setTiles(null)
    setGun(readGun(parsed.world))
    setTarget(null)
    setPlacing('gun')
    setView(null)
    setAdding(false)
    setNotice(
      ru
        ? `Карта ${parsed.world} загружена: ${parsed.size}×${parsed.size} точек, шаг ${parsed.step} м.`
        : `Map ${parsed.world} loaded: ${parsed.size}×${parsed.size} points, step ${parsed.step} m.`
    )
  }

  async function pasteFromClipboard() {
    try {
      await importText(await navigator.clipboard.readText())
    } catch {
      setNotice(
        ru
          ? 'Браузер не дал прочитать буфер. Вставьте высоты в поле ниже (Ctrl+V).'
          : 'The browser blocked the clipboard. Paste the heights into the field below (Ctrl+V).'
      )
    }
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(exportScript)
      setNotice(ru ? 'Скрипт скопирован.' : 'Script copied.')
    } catch {
      setNotice(
        ru
          ? 'Не удалось скопировать — скрипт есть в файле web/src/data/export-heightmap.sqf.'
          : 'Copy failed — the script is in web/src/data/export-heightmap.sqf.'
      )
    }
  }

  async function removeMap() {
    if (!map || !mapKey.startsWith('local:')) return
    const message = ru
      ? `Удалить высоты карты ${map.world}?`
      : `Delete the heights of ${map.world}?`
    if (!window.confirm(message)) return
    try {
      await deleteHeightmap(map.world)
      setMaps(await listHeightmaps())
    } catch {
      // Не удалось удалить — список не меняется
    }
    setMap(null)
    setMapKey('')
    setTiles(null)
    setGun(null)
    setTarget(null)
  }

  // ---- размер холста ----
  // Ширина контейнера: сразу при появлении и при каждом изменении
  const containerRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    const measure = () => {
      const width = Math.floor(element.getBoundingClientRect().width)
      setSize({ width, height: Math.min(width, 760) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Чёткость на экранах с масштабированием
  const ratio = window.devicePixelRatio || 1

  // Загруженные тайлы спутника; готовый тайл — повод перерисовать
  const tileCache = useRef(new Map<string, HTMLImageElement>())
  const [tileTick, setTileTick] = useState(0)
  function tileImage(url: string): HTMLImageElement {
    let image = tileCache.current.get(url)
    if (!image) {
      image = new Image()
      image.crossOrigin = 'anonymous'
      image.decoding = 'async'
      image.onload = () => setTileTick((value) => value + 1)
      image.src = url
      tileCache.current.set(url, image)
    }
    return image
  }

  const activeView =
    view ?? (map && size.width > 0 ? fitView(map, size.width, size.height) : null)

  // ---- отрисовка ----
  useEffect(() => {
    if (!canvas || !map || !relief || !activeView) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x0, y0, scale } = activeView
    const toScreen = (p: MapPoint) => ({
      x: (p.x - x0) * scale,
      y: (y0 - p.y) * scale,
    })

    // Цвета холста — из темы интерфейса
    const gunColor = themeColor('--color-gun') || '#4393e4'
    const targetColor = themeColor('--color-target') || '#e47474'
    const ink = night
      ? {
          bg: '#000000',
          grid: 'rgba(255,255,255,0.12)',
          gridKm: 'rgba(255,255,255,0.32)',
          gridText: 'rgba(255,255,255,0.55)',
          plate: 'rgba(0,0,0,0.7)',
          text: '#f0f4f8',
          outline: '#000000',
        }
      : {
          bg: '#0b0d0e',
          grid: 'rgba(255,255,255,0.18)',
          gridKm: 'rgba(255,255,255,0.45)',
          gridText: 'rgba(255,255,255,0.8)',
          plate: 'rgba(0,0,0,0.6)',
          text: '#ffffff',
          outline: '#000000',
        }
    const sans = "'Inter Variable', system-ui, sans-serif"
    const mono = sans

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = ink.bg
    ctx.fillRect(0, 0, size.width, size.height)

    // Пиксель изображения i — узел x = i·step, покрывает ±step/2
    const extent = mapExtent(map)
    const half = map.step / 2
    const topLeft = toScreen({ x: -half, y: extent + half })
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(
      relief,
      topLeft.x,
      topLeft.y,
      (extent + map.step) * scale,
      (extent + map.step) * scale
    )

    // Спутниковый снимок поверх рельефа: пока тайл грузится, виден рельеф
    if (tiles) {
      const z = tileLevel(tiles, scale * ratio)
      const visible = visibleTiles(tiles, z, {
        minX: x0,
        maxX: x0 + size.width / scale,
        minY: y0 - size.height / scale,
        maxY: y0,
      })
      for (const tile of visible) {
        const image = tileImage(tile.url)
        if (!image.complete || image.naturalWidth === 0) continue
        const p = toScreen({ x: tile.x, y: tile.y })
        // +0.5 px — без щелей между тайлами при дробном масштабе
        const side = tile.meters * scale + 0.5
        ctx.drawImage(image, p.x, p.y, side, side)
      }
    }

    // Сетка: 100 м / 1 км / 10 км — по масштабу
    const spacing =
      GRID_SPACINGS.find((s) => s * scale >= 48) ??
      GRID_SPACINGS[GRID_SPACINGS.length - 1]
    const bottom = y0 - size.height / scale
    ctx.font = `10px ${mono}`
    ctx.lineWidth = 1

    for (let x = Math.ceil(x0 / spacing) * spacing; (x - x0) * scale <= size.width; x += spacing) {
      if (x < 0 || x > extent) continue
      const sx = Math.round((x - x0) * scale) + 0.5
      ctx.strokeStyle = x % 1000 === 0 ? ink.gridKm : ink.grid
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, size.height)
      ctx.stroke()
      ctx.fillStyle = ink.gridText
      ctx.fillText(String(Math.floor(x / 100)).padStart(3, '0'), sx + 3, 12)
    }
    for (let y = Math.ceil(bottom / spacing) * spacing; y <= y0; y += spacing) {
      if (y < 0 || y > extent) continue
      const sy = Math.round((y0 - y) * scale) + 0.5
      ctx.strokeStyle = y % 1000 === 0 ? ink.gridKm : ink.grid
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(size.width, sy)
      ctx.stroke()
      ctx.fillStyle = ink.gridText
      ctx.fillText(String(Math.floor(y / 100)).padStart(3, '0'), 3, sy - 3)
    }

    // Метки: значок цвета метки, подпись и возраст; старые бледнее
    ctx.font = `12px ${sans}`
    for (const marker of markers) {
      const p = toScreen(marker)
      if (p.x < -40 || p.y < -40 || p.x > size.width + 40 || p.y > size.height + 40) continue
      ctx.globalAlpha = markerOpacity(now - marker.createdAt)
      ctx.fillStyle = MARKER_RGB[marker.color]
      ctx.strokeStyle = ink.outline
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(p.x, p.y - 8)
      ctx.lineTo(p.x + 8, p.y)
      ctx.lineTo(p.x, p.y + 8)
      ctx.lineTo(p.x - 8, p.y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      const text = `${markerTitle(marker, ru)} · ${formatAge(now - marker.createdAt, ru)}`
      const width = ctx.measureText(text).width
      ctx.fillStyle = ink.plate
      ctx.fillRect(p.x + 11, p.y - 9, width + 8, 18)
      ctx.fillStyle = MARKER_RGB[marker.color]
      ctx.fillRect(p.x + 11, p.y - 9, 2, 18)
      ctx.fillStyle = ink.text
      ctx.fillText(text, p.x + 16, p.y + 4)
    }
    ctx.globalAlpha = 1

    // Цели журнала: перекрестие в рамке и название
    ctx.font = `11px ${mono}`
    for (const saved of journalTargets) {
      if (saved.target.world !== map.world) continue
      const p = toScreen(saved.target)
      if (p.x < -40 || p.y < -40 || p.x > size.width + 40 || p.y > size.height + 40) continue
      const color = saved.active ? gunColor : ink.text
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.strokeRect(p.x - 6.5, p.y - 6.5, 13, 13)
      ctx.beginPath()
      ctx.moveTo(p.x - 11, p.y)
      ctx.lineTo(p.x - 3, p.y)
      ctx.moveTo(p.x + 3, p.y)
      ctx.lineTo(p.x + 11, p.y)
      ctx.moveTo(p.x, p.y - 11)
      ctx.lineTo(p.x, p.y - 3)
      ctx.moveTo(p.x, p.y + 3)
      ctx.lineTo(p.x, p.y + 11)
      ctx.stroke()
      const width = ctx.measureText(saved.name).width
      ctx.fillStyle = ink.plate
      ctx.fillRect(p.x - width / 2 - 4, p.y + 13, width + 8, 16)
      ctx.fillStyle = color
      ctx.fillText(saved.name, p.x - width / 2, p.y + 25)
    }

    if (draft) {
      const p = toScreen(draft.point)
      ctx.strokeStyle = MARKER_RGB[draft.color]
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Линия огня по цели (лесополоса): полоса поражения, ось и точки
    if (linePoints.length > 0) {
      const pts = linePoints.map(toScreen)
      const lineColor = '#ffb020'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (pts.length > 1) {
        // Полоса шириной в зону поражения
        ctx.strokeStyle = 'rgba(255,176,32,0.22)'
        ctx.lineWidth = Math.max(4, lineWeapon.radius * 2 * scale)
        ctx.beginPath()
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.stroke()
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.setLineDash([7, 5])
        ctx.beginPath()
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'miter'
      for (const p of pts) {
        ctx.fillStyle = lineColor
        ctx.strokeStyle = ink.outline
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.font = 'bold 11px ' + sans
      ctx.textAlign = 'center'
      lineAim.forEach((point, i) => {
        const p = toScreen(point)
        const current = i === lineIndex
        ctx.strokeStyle = current ? '#ffffff' : lineColor
        ctx.lineWidth = current ? 2.5 : 1.5
        ctx.fillStyle = current ? 'rgba(255,176,32,0.9)' : 'rgba(0,0,0,0.65)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = current ? '#000000' : '#ffffff'
        ctx.fillText(String(i + 1), p.x, p.y + 4)
      })
      ctx.textAlign = 'start'
    }

    // Линия огня
    if (gun && target) {
      const a = toScreen(gun)
      const b = toScreen(target)
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    // Орудие — синяя точка, цель — красная со свечением
    if (gun) {
      const p = toScreen(gun)
      ctx.fillStyle = gunColor
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    if (target) {
      const p = toScreen(target)
      const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 16)
      glow.addColorStop(0, targetColor)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = targetColor
      ctx.beginPath()
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [canvas, map, relief, activeView, gun, target, size, unitM, ratio, markers, now, draft, ru, night, journalTargets, tiles, tileTick, linePoints, lineAim, lineIndex, lineWeapon])

  // ---- масштаб колёсиком (нужен не-пассивный обработчик) ----
  const viewRef = useRef<View | null>(null)
  useEffect(() => {
    viewRef.current = activeView
  })

  function zoomAt(factor: number, sx: number, sy: number) {
    const current = viewRef.current
    if (!current || !map) return
    const minScale = fitView(map, size.width, size.height).scale / 2
    const scale = Math.min(MAX_SCALE, Math.max(minScale, current.scale * factor))
    const wx = current.x0 + sx / current.scale
    const wy = current.y0 - sy / current.scale
    setView({ scale, x0: wx - sx / scale, y0: wy + sy / scale })
  }

  const zoomRef = useRef(zoomAt)
  useEffect(() => {
    zoomRef.current = zoomAt
  })

  useEffect(() => {
    if (!canvas) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect()
      zoomRef.current(
        Math.exp(-event.deltaY * 0.0015),
        event.clientX - rect.left,
        event.clientY - rect.top
      )
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [canvas])

  // ---- перетаскивание и клики ----
  // Мышь: ЛКМ — орудие (или метка), ПКМ — цель, перетаскивание — сдвиг.
  // Касание: что ставить, выбирает переключатель под картой.
  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeView) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      view: activeView,
      moved: false,
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    setView({
      scale: drag.view.scale,
      x0: drag.view.x0 - dx / drag.view.scale,
      y0: drag.view.y0 + dy / drag.view.scale,
    })
  }

  /** Подставить орудие и цель в расчёт — сразу, без кнопки. */
  function applyPoints(gunPoint: MapPoint | null, targetPoint: MapPoint | null) {
    if (!map || !gunPoint || !targetPoint) return
    const ownHeight = heightAt(map, gunPoint)
    const targetHeight = heightAt(map, targetPoint)
    if (ownHeight === null || targetHeight === null) return
    const line = bearing(gunPoint, targetPoint)
    onApply({
      distance: line.distance,
      azimuthMil: line.azimuthMil,
      ownHeight,
      targetHeight,
      target: { world: map.world, x: targetPoint.x, y: targetPoint.y },
    })
  }

  function changeLine(points: MapPoint[]) {
    setLinePoints(points)
    setLineIndex(null)
    if (map) writeStored(`mapLine:${map.world}`, JSON.stringify(points))
  }

  /** Точка линии огня — целью расчёта. */
  function aimAt(index: number) {
    const point = lineAim[index]
    if (!point) return
    setLineIndex(index)
    placeTarget(point)
  }

  function toggleGunLock() {
    if (!map || !gun) return
    const locked = !gunLocked
    setGunLocked(locked)
    writeStored(`mapGunLocked:${map.world}`, locked ? 'on' : 'off')
    if (locked) setPlacing('target')
    onGunLockChange?.(locked, heightAt(map, gun))
  }

  function placeGun(point: MapPoint) {
    if (!map || gunLocked) return
    setGun(point)
    writeStored(`mapGun:${map.world}`, JSON.stringify(point))
    applyPoints(point, target)
  }

  function placeTarget(point: MapPoint) {
    setTarget(point)
    applyPoints(gun, point)
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved || !map) return
    // Средняя кнопка — только сдвиг
    if (event.button === 1) return

    const rect = event.currentTarget.getBoundingClientRect()
    const point = {
      x: drag.view.x0 + (event.clientX - rect.left) / drag.view.scale,
      y: drag.view.y0 - (event.clientY - rect.top) / drag.view.scale,
    }
    if (!isInside(map, point)) return

    const mouse = event.pointerType === 'mouse'
    let action: Placing =
      mouse && event.button === 2
        ? 'target'
        : mouse && placing === 'target'
          ? 'gun'
          : placing

    // Орудие закреплено — касание ставит цель
    if (gunLocked && action === 'gun') action = 'target'

    if (action === 'marker') {
      setDraft({ point, label: '', color: markerColor })
      return
    }

    if (action === 'line') {
      changeLine([...linePoints, point])
      return
    }

    // Клик по цели журнала — загрузить её
    const journalHit = journalTargets.find(
      (t) =>
        t.target.world === map.world &&
        Math.hypot(t.target.x - point.x, t.target.y - point.y) *
          drag.view.scale <=
          MARKER_HIT_PX
    )
    if (journalHit && action === 'target' && onPickJournalTarget) {
      onPickJournalTarget(journalHit.id)
      return
    }

    if (action === 'gun') {
      placeGun(point)
      // На телефоне следующим касанием — цель
      if (!mouse) setPlacing('target')
      return
    }

    // Клик рядом с меткой — цель ставится точно в неё
    const hit = markers.find(
      (m) =>
        Math.hypot(m.x - point.x, m.y - point.y) * drag.view.scale <=
        MARKER_HIT_PX
    )
    placeTarget(hit ? { x: hit.x, y: hit.y } : point)
  }

  const gunHeight = map && gun ? heightAt(map, gun) : null
  const targetHeight = map && target ? heightAt(map, target) : null

  const buttonClass = 'btn btn-sm'

  const showLoader = adding || !map

  return (
    <div>
      {showLoader && (
        <div className="flex aspect-square flex-col justify-center gap-4 rounded-lg bg-app-surface p-6 text-[15px] text-app-text-2 sm:p-10">
          <p className="text-lg font-semibold text-app-text">
            {ru ? 'Добавьте карту' : 'Add a map'}
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <button type="button" className={buttonClass} onClick={() => void copyScript()}>
                {ru ? 'Скопировать скрипт для игры' : 'Copy the game script'}
              </button>
            </li>
            <li>
              {ru
                ? 'В Arma 3: редактор Eden на нужной карте → Play → Esc → Debug Console → вставить скрипт → LOCAL EXEC. Высоты скопируются в буфер обмена.'
                : 'In Arma 3: Eden editor on the map → Play → Esc → Debug Console → paste the script → LOCAL EXEC. The heights are copied to the clipboard.'}
            </li>
            <li className="space-x-2">
              <button type="button" className={buttonClass} onClick={() => void pasteFromClipboard()}>
                {ru ? 'Вставить высоты' : 'Paste heights'}
              </button>
              <span className="text-app-muted">{ru ? 'или' : 'or'}</span>
              <button type="button" className={buttonClass} onClick={() => fileRef.current?.click()}>
                {ru ? 'Загрузить файл' : 'Load a file'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.txt,application/json,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void file.text().then(importText)
                  event.target.value = ''
                }}
              />
            </li>
          </ol>
          <textarea
            rows={2}
            aria-label={ru ? 'Вставьте высоты сюда' : 'Paste the heights here'}
            placeholder={ru ? '…или вставьте высоты сюда (Ctrl+V)' : '…or paste the heights here (Ctrl+V)'}
            onPaste={(event) => {
              event.preventDefault()
              void importText(event.clipboardData.getData('text'))
            }}
            className="field text-sm"
          />
          <p className="text-[13px] text-app-muted">
            {ru
              ? 'Карта рисуется из высот: чужие изображения карт не нужны. Высоты хранятся только на этом устройстве.'
              : 'The map is drawn from the heights, no map images needed. Heights stay on this device.'}
          </p>
          {map && (
            <button type="button" className="btn self-start" onClick={() => setAdding(false)}>
              {ru ? 'Назад к карте' : 'Back to the map'}
            </button>
          )}
        </div>
      )}

      {map && !adding && (
        <div ref={containerRef} className="relative w-full">
          <canvas
            ref={setCanvas}
            width={Math.round(size.width * ratio)}
            height={Math.round(size.height * ratio)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (dragRef.current = null)}
            onContextMenu={(event) => event.preventDefault()}
            style={{ width: size.width, height: size.height }}
            className="block cursor-crosshair touch-none rounded-lg"
          />

          {/* Справа: что ставит касание */}
          <div
            role="toolbar"
            aria-label={ru ? 'Что ставит касание' : 'Tap places'}
            aria-orientation="vertical"
            className="absolute top-2 right-2 flex flex-col gap-1 rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm"
          >
            {(
              [
                { id: 'gun', icon: 'gun', ru: 'Орудие', en: 'Gun' },
                { id: 'target', icon: 'target', ru: 'Цель', en: 'Target' },
                ...(showMarkers
                  ? [{ id: 'marker', icon: 'marker', ru: 'Метка', en: 'Marker' }]
                  : []),
                { id: 'line', icon: 'line', ru: 'Огневая линия', en: 'Fire line' },
              ] as { id: Placing; icon: FieldIconName; ru: string; en: string }[]
            ).map((tool) => {
              const active = placing === tool.id
              const disabled = tool.id === 'gun' && gunLocked
              return (
                <button
                  key={tool.id}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  title={ru ? tool.ru : tool.en}
                  aria-label={ru ? tool.ru : tool.en}
                  onClick={() => setPlacing(tool.id)}
                  className={[
                    'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                    active
                      ? 'bg-accent-solid text-white'
                      : 'text-white/80 hover:bg-white/15',
                  ].join(' ')}
                >
                  <FieldIcon name={tool.icon} className="h-5 w-5" />
                </button>
              )
            })}
            <div className="mx-1 h-px bg-white/20" />
            <button
              type="button"
              aria-pressed={gunLocked}
              disabled={!gun}
              title={
                gunLocked
                  ? ru ? 'Орудие закреплено — нажмите, чтобы освободить' : 'Gun locked — tap to unlock'
                  : ru ? 'Закрепить орудие (и его высоту)' : 'Lock the gun (and its height)'
              }
              aria-label={ru ? 'Закрепить орудие' : 'Lock the gun'}
              onClick={toggleGunLock}
              className={[
                'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                gunLocked ? 'bg-warn/90 text-black' : 'text-white/80 hover:bg-white/15',
              ].join(' ')}
            >
              <FieldIcon name={gunLocked ? 'lock' : 'unlock'} className="h-5 w-5" />
            </button>
          </div>

          {/* Слева: быстрый выбор сохранённых целей */}
          {quickTargets.length > 0 && (
            <div className="absolute top-2 left-2 flex max-w-[55%] flex-col items-start gap-1">
              <button
                type="button"
                aria-expanded={targetsOpen}
                onClick={() => setTargetsOpen((v) => !v)}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-black/70 px-2.5 text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
              >
                <FieldIcon name="list" className="h-5 w-5" />
                {ru ? 'Цели' : 'Targets'}
                <span className="rounded-full bg-white/20 px-1.5 text-[11.5px]">
                  {quickTargets.length}
                </span>
              </button>
              {targetsOpen && (
                <ul className="max-h-[min(22rem,60%)] w-48 max-w-full overflow-y-auto rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm">
                  {quickTargets.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-current={t.active ? 'true' : undefined}
                        onClick={() => onPickJournalTarget?.(t.id)}
                        className={[
                          'flex w-full cursor-pointer flex-col rounded-md px-2 py-1 text-left transition-colors',
                          t.active
                            ? 'bg-accent-solid text-white'
                            : 'text-white/90 hover:bg-white/15',
                        ].join(' ')}
                      >
                        <span className="truncate text-[13px] font-medium">{t.name}</span>
                        <span className="truncate text-[11.5px] tabular-nums opacity-70">
                          {t.detail}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {notice && (
        <p className="mt-3 rounded-md bg-app-raised px-3 py-2 text-[13.5px] text-app-text-2" role="status">
          {notice}
        </p>
      )}

      {/* ---- Панель под картой ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(maps.length > 0 || builtin.length > 0) && (
          <Dropdown
            label={ru ? 'Карта' : 'Map'}
            value={mapKey}
            onChange={openMap}
            alignLeft
            placeholder="—"
            options={[
              // Официальные карты — выше карт сообщества
              ...[...builtin]
                .sort((a, b) => Number(mapKind(b) === 'official') - Number(mapKind(a) === 'official'))
                .map((m) => ({
                value: `builtin:${m.world}`,
                label: m.displayName,
                description: m.author ? `© ${m.author}` : undefined,
                group:
                  mapKind(m) === 'official'
                    ? ru
                      ? 'Официальные'
                      : 'Official'
                    : ru
                      ? 'Сообщество'
                      : 'Community',
              })),
              ...maps.map((m) => ({
                value: `local:${m.world}`,
                label: m.world,
                description: ru ? 'свои высоты' : 'own heights',
                group: ru ? 'Загруженные' : 'Imported',
              })),
            ]}
          />
        )}
        {(maps.length > 0 || builtin.length > 0) && !adding && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            <FieldIcon name="plus" />
            {ru ? 'Карта' : 'Map'}
          </button>
        )}
        {map && !adding && (
          <>
            <div className="ml-auto flex gap-1">
              <button type="button" className="btn px-3" aria-label="−" onClick={() => zoomAt(1 / 1.6, size.width / 2, size.height / 2)}><FieldIcon name="minus" /></button>
              <button type="button" className="btn px-3" aria-label="+" onClick={() => zoomAt(1.6, size.width / 2, size.height / 2)}><FieldIcon name="plus" /></button>
              <button type="button" className="btn" onClick={() => setView(null)}>
                <FieldIcon name="fit" />
                {ru ? 'Вся' : 'Fit'}
              </button>
            </div>
          </>
        )}
      </div>

      {map && !adding && (
        <>
          <p className="mt-2 text-[13px] text-app-muted tabular-nums">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-gun" />
            {gun
              ? `${toGridReference(gun, 8)} · ${Math.round(gunHeight ?? 0)} ${unitM}`
              : ru
                ? 'орудие не задано'
                : 'no gun'}
            <span className="mx-3 text-app-faint">|</span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-target" />
            {target
              ? `${toGridReference(target, 8)} · ${Math.round(targetHeight ?? 0)} ${unitM}`
              : ru
                ? 'цель не задана'
                : 'no target'}
          </p>

          {(placing === 'line' || linePoints.length > 0) && (
            <div className="mt-3 rounded-lg bg-app-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label">
                  {ru ? 'Огонь по линии' : 'Line fire'}
                </span>
                <Dropdown
                  alignLeft
                  label={ru ? 'Радиус поражения' : 'Kill radius'}
                  value={lineWeaponId}
                  onChange={(id) => {
                    setLineWeaponId(id)
                    setLineIndex(null)
                    writeStored('lineWeapon', id)
                  }}
                  options={LINE_WEAPONS.map((w) => ({
                    value: w.id,
                    label: `${lineWeaponName(w.id, ru)} · ±${w.radius} ${unitM}`,
                  }))}
                />
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={linePoints.length === 0}
                    onClick={() => changeLine(linePoints.slice(0, -1))}
                  >
                    {ru ? 'Убрать точку' : 'Undo point'}
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={linePoints.length === 0}
                    onClick={() => changeLine([])}
                  >
                    {ru ? 'Стереть' : 'Clear'}
                  </button>
                </div>
              </div>

              {linePoints.length === 0 ? (
                <p className="mt-2 text-[13px] text-app-muted">
                  {ru
                    ? 'Расставьте точки по лесополосе, дороге или траншее — приложение разложит по ней точки прицеливания.'
                    : 'Tap points along a tree line, road or trench — the app lays aim points along it.'}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[13px] text-app-muted tabular-nums">
                    {ru ? 'Длина' : 'Length'}{' '}
                    {Math.round(polylineLength(linePoints))} {unitM} ·{' '}
                    {ru ? 'точек прицеливания' : 'aim points'} {lineAim.length}{' '}
                    · {ru ? 'шаг' : 'spacing'} ≤ {lineWeapon.radius * 2} {unitM}
                  </p>
                  <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {lineAim.map((point, i) => {
                      const line = gun ? bearing(gun, point) : null
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={!gun}
                          onClick={() => aimAt(i)}
                          aria-pressed={lineIndex === i}
                          title={toGridReference(point, 8)}
                          className={[
                            'rounded-md px-2.5 py-1 text-[13px] tabular-nums transition-colors',
                            lineIndex === i
                              ? 'bg-accent-soft ring-1 ring-accent'
                              : 'bg-app-raised hover:bg-app-raised-hover',
                            gun ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                          ].join(' ')}
                        >
                          <b>{i + 1}</b>
                          {line && (
                            <span className="ml-1.5 text-app-muted">
                              {Math.round(line.distance)} {unitM} ·{' '}
                              {Math.round(line.azimuthMil)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {!gun && (
                    <p className="mt-2 text-[13px] text-app-muted">
                      {ru
                        ? 'Поставьте орудие — тогда точка станет целью расчёта одним нажатием.'
                        : 'Place the gun — then one tap makes a point the target.'}
                    </p>
                  )}
                  {gun && lineAim.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={lineIndex === null || lineIndex <= 0}
                        onClick={() => aimAt((lineIndex ?? 1) - 1)}
                      >
                        ← {ru ? 'Предыдущая' : 'Previous'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={lineIndex !== null && lineIndex >= lineAim.length - 1}
                        onClick={() => aimAt(lineIndex === null ? 0 : lineIndex + 1)}
                      >
                        {lineIndex === null
                          ? ru ? 'Первая точка' : 'First point'
                          : ru ? 'Следующая' : 'Next'}{' '}
                        →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {draft && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-app-surface p-2">
              <span className="text-[13px] text-app-muted tabular-nums">
                {toGridReference(draft.point, 8)}
              </span>
              <input
                autoFocus
                value={draft.label}
                maxLength={40}
                placeholder={ru ? 'Подпись (необязательно)' : 'Label (optional)'}
                onChange={(event) =>
                  setDraft({ ...draft, label: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveDraft()
                  if (event.key === 'Escape') setDraft(null)
                }}
                className="field min-w-0 flex-1"
              />
              <ColorPicker
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
                language={language}
              />
              <button type="button" onClick={saveDraft} className="btn btn-primary">
                {ru ? 'Поставить' : 'Place'}
              </button>
              <button type="button" onClick={() => setDraft(null)} className="btn">
                {ru ? 'Отмена' : 'Cancel'}
              </button>
            </div>
          )}

          {showMarkers && (
          <details className="disclosure panel mt-3 p-4">
            <summary>
              <span className="inline-flex items-center gap-2">
                <FieldIcon name="marker" className="h-5 w-5 text-app-muted" />
                {ru ? 'Метки' : 'Markers'}
              </span>
              <span className="tag">{markers.length}</span>
            </summary>

            <MarkerList
              markers={markers}
              now={now}
              language={language}
              onTarget={(marker) => placeTarget({ x: marker.x, y: marker.y })}
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="label">
                {ru ? 'Метка по координате' : 'Marker by grid'}
              </span>
              <input
                value={gridDraft}
                onChange={(event) => setGridDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addByGrid()
                }}
                placeholder="045 078"
                inputMode="numeric"
                className="field w-32"
              />
              <button
                type="button"
                onClick={addByGrid}
                disabled={!parseGrid(gridDraft)}
                className={buttonClass}
              >
                {ru ? 'Добавить' : 'Add'}
              </button>
            </div>
          </details>
          )}

          {showMarkers && showScreenMarkers && (
            <ScreenMarkers world={map.world} author={author} language={language} />
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-app-muted">
              {mapKey.startsWith('builtin:') && (() => {
                const entry = builtin.find((m) => `builtin:${m.world}` === mapKey)
                return entry ? `${entry.displayName}${entry.author ? ` · © ${entry.author}` : ''} · ` : ''
              })()}
              {ru
                ? `Высоты по сетке с шагом ${Math.round(map.step * 10) / 10} м.`
                : `Heights on a ${Math.round(map.step * 10) / 10} m grid.`}
            </p>
            {mapKey.startsWith('local:') && (
              <button type="button" className="btn btn-ghost btn-danger btn-sm" onClick={() => void removeMap()}>
                {ru ? 'Удалить карту' : 'Delete map'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function lineWeaponName(id: LineWeapon['id'], ru: boolean): string {
  switch (id) {
    case 'mortar':
      return ru ? 'Миномёт' : 'Mortar'
    case 'artillery':
      return ru ? 'Артиллерия' : 'Artillery'
    case 'rocket':
      return ru ? 'Реактивная' : 'Rocket'
    case 'rocket-wide':
      return ru ? 'Реактивная (широкий)' : 'Rocket (wide)'
  }
}

function ColorPicker({
  value,
  onChange,
  language,
}: {
  value: MarkerColor
  onChange: (color: MarkerColor) => void
  language: Language
}) {
  const ru = language === 'ru'
  return (
    <div
      role="radiogroup"
      aria-label={ru ? 'Цвет' : 'Colour'}
      className="flex gap-1"
    >
      {MARKER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={ru ? COLOR_NAMES[color].ru : COLOR_NAMES[color].en}
          onClick={() => onChange(color)}
          style={{ backgroundColor: MARKER_RGB[color] }}
          className={[
            'h-6 w-6 cursor-pointer rounded-full ring-offset-2 ring-offset-app-surface',
            value === color ? 'ring-2 ring-accent' : '',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

function MarkerList({
  markers,
  now,
  language,
  onTarget,
}: {
  markers: MapMarker[]
  now: number
  language: Language
  onTarget: (marker: MapMarker) => void
}) {
  const ru = language === 'ru'
  if (markers.length === 0) {
    return (
      <p className="mt-3 text-xs text-app-muted">
        {ru
          ? 'Меток нет. Режим «метка» — клик по карте; в связке метки видят все в комнате.'
          : 'No markers. "Marker" mode — click the map; in a link everyone in the room sees them.'}
      </p>
    )
  }
  return (
    <ul className="mt-3 divide-y divide-app-border overflow-hidden rounded-lg bg-app-raised text-sm">
      {markers.map((marker) => (
        <li
          key={marker.id}
          className="flex flex-wrap items-center gap-2 px-3 py-1.5"
          style={{ opacity: markerOpacity(now - marker.createdAt) }}
        >
          <span
            className="h-3 w-3 shrink-0 rotate-45"
            style={{ backgroundColor: MARKER_RGB[marker.color] }}
          />
          <span className="min-w-0 flex-1 truncate text-app-text">
            {markerTitle(marker, ru)}
            <span className="label ml-2 text-[12.5px]">
              {marker.author}
              {marker.source === 'screen' && (ru ? ' · с экрана' : ' · from screen')}
            </span>
          </span>
          <span className="text-xs text-app-muted">
            {toGridReference(marker, 8)}
          </span>
          <span className="mono-num w-24 text-right text-[12.5px] text-app-muted">
            {formatAge(now - marker.createdAt, ru)}
          </span>
          <button
            type="button"
            onClick={() => onTarget(marker)}
            className="btn btn-sm"
          >
            {ru ? 'Цель' : 'Target'}
          </button>
          <button
            type="button"
            onClick={() => removeMarker(marker.id)}
            aria-label={ru ? 'Удалить метку' : 'Delete marker'}
            className="cursor-pointer px-1.5 text-app-muted hover:text-danger"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

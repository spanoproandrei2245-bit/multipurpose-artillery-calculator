import { t, type MessageKey } from '../i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  bearing,
  heightAt,
  isInside,
  mapExtent,
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
  distanceToStroke,
  readStrokes,
  simplify,
  writeStrokes,
  type DrawStroke,
} from '../lib/mapDraw'
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
import { Dropdown, type DropdownOption } from './Dropdown'
import { MapRequests } from './MapRequests'
import { PickerDialog } from './PickerDialog'
import type { JournalActions } from '../lib/journalIO'
import { FieldIcon, type FieldIconName } from './FieldIcon'
import { useFlightOnMap } from '../lib/animation'
import { FlightCanvas, type FlightShot } from './FlightCanvas'
import { FlightTrack } from './FlightTrack'
import { useFavorites } from '../lib/favorites'
import { shellKind } from '../lib/shellKind'
import type { ArtilleryCategory } from '../types/gameModel'
import { MAPS_BASE } from '../lib/builtinMaps'
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
  // Журнал целей: экспорт, импорт, переименование, удаление; без него панели нет
  targetActions?: JournalActions
  // Радиус досягаемости орудия, м: показывается кольцами вокруг орудия
  reach?: { min: number; max: number } | null
  // Снаряд в полёте: анимация от орудия к цели
  flight?: readonly FlightShot[]
  category?: ArtilleryCategory
  shellType?: string
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

type Placing = 'gun' | 'target' | 'marker' | 'line' | 'pen' | 'draw-line' | 'eraser'

const isDrawTool = (p: Placing) => p === 'pen' || p === 'draw-line' || p === 'eraser'

// Клик ближе — попадание в метку, пиксели
const MARKER_HIT_PX = 14

const COLOR_NAMES: Record<MarkerColor, MessageKey> = {
  red: 'mapPicker.red',
  orange: 'mapPicker.orange',
  yellow: 'mapPicker.yellow',
  green: 'mapPicker.green',
  blue: 'mapPicker.blue',
  purple: 'mapPicker.purple',
  black: 'mapPicker.black',
}

function markerTitle(marker: MapMarker): string {
  const color = t(COLOR_NAMES[marker.color])
  return marker.label || `${t('mapPicker.marker')} (${color})`
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
  targetActions,
  reach = null,
  flight = [],
  category = 'mortar',
  shellType = 'HE',
  onGunLockChange,
}: Props) {
  const ru = language === 'ru'
  const unitM = t('unit.m')

  const flightOnMap = useFlightOnMap()
  // Избранные карты: ключи пунктов списка, показываются сверху
  const [favorites, toggleFavorite] = useFavorites('favMaps')
  // Встроенные карты (спутник + высоты) и тайлы открытой карты
  const [builtin, setBuiltin] = useState<BuiltinMapEntry[]>([])
  const [tiles, setTiles] = useState<MapTiles | null>(null)
  // Какой пункт списка открыт: «builtin:stratis» или «local:altis»
  const [mapKey, setMapKey] = useState('')
  const [map, setMap] = useState<Heightmap | null>(null)
  // Окно «Предложить карту»
  const [suggesting, setSuggesting] = useState(false)
  // Окно выбора карты мода (с поиском)
  const [pickingMod, setPickingMod] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [gun, setGun] = useState<MapPoint | null>(null)
  const [target, setTarget] = useState<MapPoint | null>(null)
  const [placing, setPlacing] = useState<Placing>('gun')

  // Орудие закреплено на карте: касания его не двигают
  const [gunLocked, setGunLocked] = useState(false)
  // Список целей слева: на узком экране свёрнут
  const importRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
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
      ? t('mapPicker.gunner')
      : t('mapPicker.fdc'))
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
  const [markersOpen, setMarkersOpen] = useState(false)

  // ---- рисунок на карте ----
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const [liveStroke, setLiveStroke] = useState<DrawStroke | null>(null)
  const [drawColor, setDrawColor] = useState<MarkerColor>('red')
  const [clearArmed, setClearArmed] = useState(false)
  const [drawOpen, setDrawOpen] = useState(false)
  const drawSeq = useRef(0)
  const drawRef = useRef<{ stroke: DrawStroke; erasing: boolean } | null>(null)
  useEffect(() => {
    if (!clearArmed) return
    const timer = window.setTimeout(() => setClearArmed(false), 3000)
    return () => window.clearTimeout(timer)
  }, [clearArmed])

  function commitStrokes(next: DrawStroke[]) {
    setStrokes(next)
    if (map) writeStrokes(map.world, next)
  }
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
    // Старые версии хранили «local:…» и просто имя мира: берём только имя
    const world = key.includes(':') ? key.split(':', 2)[1] : key
    const load = loadBuiltinMap(world).then((result) =>
      result ? { heightmap: result.heightmap, tiles: result.tiles } : null
    )
    load
      .then((loaded) => {
        if (!loaded) return
        writeStored('mapWorld', `builtin:${world}`)
        setMapKey(`builtin:${world}`)
        setMap(loaded.heightmap)
        setTiles(loaded.tiles)
        setGun(readGun(world))
        setGunLocked(readStoredText(`mapGunLocked:${world}`) === 'on')
        setLinePoints(readLine(world))
        setLineIndex(null)
        setStrokes(readStrokes(world))
        setLiveStroke(null)
        setTarget(
          currentTarget?.world === world
            ? { x: currentTarget.x, y: currentTarget.y }
            : null
        )
        setPlacing('gun')
        setView(null)
      })
      .catch(() =>
        setNotice(t('mapPicker.could-not-open-the-map'))
      )
  }

  useEffect(() => {
    void listBuiltinMaps().then((embedded) => {
      setBuiltin(embedded)
      const keys = embedded.map((m) => `builtin:${m.world}`)
      const last = readStoredText('mapWorld')
      const key =
        keys.find((k) => k === last) ??
        keys.find((k) => k === `builtin:${last}`) ??
        keys[0]
      if (key) openMap(key)
    })
    // Только при первом показе
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    // Рисунок: штрихи под метками и целями
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    for (const stroke of liveStroke ? [...strokes, liveStroke] : strokes) {
      if (stroke.points.length === 0) continue
      ctx.strokeStyle = MARKER_RGB[stroke.color]
      ctx.beginPath()
      stroke.points.forEach((point, i) => {
        const p = toScreen(point)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      if (stroke.points.length === 1) {
        const p = toScreen(stroke.points[0])
        ctx.lineTo(p.x + 0.01, p.y)
      }
      ctx.stroke()
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

      const text = `${markerTitle(marker)} · ${formatAge(now - marker.createdAt)}`
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

    // Досягаемость орудия: дальний край — сплошное кольцо, ближний — пунктир
    if (gun && reach && reach.max > 0) {
      const c = toScreen(gun)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(255,176,32,0.9)'
      ctx.beginPath()
      ctx.arc(c.x, c.y, reach.max * scale, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,176,32,0.06)'
      ctx.fill()
      if (reach.min > 0) {
        ctx.setLineDash([5, 5])
        ctx.strokeStyle = 'rgba(255,176,32,0.6)'
        ctx.beginPath()
        ctx.arc(c.x, c.y, reach.min * scale, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
      // Подпись на верхней точке дальнего кольца
      const label = `${t('mapPicker.max')} ${Math.round(reach.max)} ${unitM}`
      ctx.font = '11px ' + sans
      const w = ctx.measureText(label).width
      const ly = c.y - reach.max * scale
      if (ly > 14 && ly < size.height - 6) {
        ctx.fillStyle = ink.plate
        ctx.fillRect(c.x - w / 2 - 4, ly - 8, w + 8, 16)
        ctx.fillStyle = 'rgba(255,196,80,1)'
        ctx.textAlign = 'center'
        ctx.fillText(label, c.x, ly + 4)
        ctx.textAlign = 'start'
      }
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
  }, [canvas, map, relief, activeView, gun, target, size, unitM, ratio, markers, now, draft, ru, night, journalTargets, tiles, tileTick, linePoints, lineAim, lineIndex, lineWeapon, reach, strokes, liveStroke])

  // ---- масштаб колёсиком (нужен не-пассивный обработчик) ----
  const viewRef = useRef<View | null>(null)
  const pointsRef = useRef<{ gun: MapPoint | null; target: MapPoint | null }>({
    gun: null,
    target: null,
  })
  useEffect(() => {
    viewRef.current = activeView
    pointsRef.current = { gun, target }
  })

  // Где рисовать полёт: от орудия к цели в координатах холста
  const flightEnds = useCallback(() => {
    const v = viewRef.current
    const { gun: g, target: t } = pointsRef.current
    if (!v || !g || !t) return null
    const ax = (g.x - v.x0) * v.scale
    const ay = (v.y0 - g.y) * v.scale
    const bx = (t.x - v.x0) * v.scale
    const by = (v.y0 - t.y) * v.scale
    return {
      ax,
      ay,
      bx,
      by,
      arc: Math.min(90, Math.hypot(bx - ax, by - ay) * 0.3),
      scale: 1.5,
    }
  }, [])

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
    // Режим рисования: ЛКМ или касание рисуют, остальные кнопки двигают карту
    if (isDrawTool(placing) && (event.pointerType !== 'mouse' || event.button === 0)) {
      const point = pointOf(event, activeView)
      if (placing === 'eraser') {
        drawRef.current = { stroke: { id: '', color: drawColor, points: [] }, erasing: true }
        eraseAt(point, activeView.scale)
      } else {
        drawRef.current = {
          stroke: { id: String(++drawSeq.current), color: drawColor, points: [point] },
          erasing: false,
        }
        setLiveStroke(drawRef.current.stroke)
      }
      return
    }
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      view: activeView,
      moved: false,
    }
  }

  /** Точка мира под курсором. */
  function pointOf(event: React.PointerEvent<HTMLCanvasElement>, v: View): MapPoint {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: v.x0 + (event.clientX - rect.left) / v.scale,
      y: v.y0 - (event.clientY - rect.top) / v.scale,
    }
  }

  /** Ластик: стереть штрихи ближе 10 пикселей к точке. */
  function eraseAt(point: MapPoint, scale: number) {
    const reachM = 10 / scale
    const next = strokesRef.current.filter((s) => distanceToStroke(s, point) > reachM)
    if (next.length !== strokesRef.current.length) commitStrokes(next)
  }
  const strokesRef = useRef(strokes)
  useEffect(() => {
    strokesRef.current = strokes
  })

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drawing = drawRef.current
    if (drawing && activeView) {
      const point = pointOf(event, activeView)
      if (drawing.erasing) {
        eraseAt(point, activeView.scale)
        return
      }
      const pts = drawing.stroke.points
      const next =
        placing === 'draw-line'
          ? [pts[0], point]
          : Math.hypot(point.x - pts[pts.length - 1].x, point.y - pts[pts.length - 1].y) *
                activeView.scale >=
              2
            ? [...pts, point]
            : pts
      if (next !== pts) {
        drawing.stroke = { ...drawing.stroke, points: next }
        setLiveStroke(drawing.stroke)
      }
      return
    }
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

  // Замок орудия выезжает после «удержания» курсора на кнопке орудия
  const [lockShown, setLockShown] = useState(false)
  const lockTimer = useRef<number | null>(null)
  function cancelLockTimer() {
    if (lockTimer.current !== null) window.clearTimeout(lockTimer.current)
    lockTimer.current = null
  }
  function startLockHold(ms: number) {
    cancelLockTimer()
    lockTimer.current = window.setTimeout(() => setLockShown(true), ms)
  }
  function endLockHold() {
    cancelLockTimer()
    setLockShown(false)
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

  function finishDrawing() {
    const drawing = drawRef.current
    drawRef.current = null
    setLiveStroke(null)
    if (!drawing || drawing.erasing || !activeView) return
    const points = simplify(drawing.stroke.points, 1.5 / activeView.scale)
    commitStrokes([...strokesRef.current, { ...drawing.stroke, points }])
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (drawRef.current) {
      finishDrawing()
      return
    }
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


  // ---- список карт: ванильные — в списке, карты модов — в окне с поиском ----
  const MOD_MAPS = '__mods__'
  const mapEntries = builtin.map((m) => ({
    key: `builtin:${m.world}`,
    name: m.names?.[language] ?? m.displayName,
    author: m.author,
    official: mapKind(m) === 'official',
    preview: `${MAPS_BASE}${m.world}/preview.webp`,
  }))
  function mapLabel(key: string): string {
    return mapEntries.find((e) => e.key === key)?.name ?? '—'
  }
  const isFavorite = (key: string) => favorites.includes(key)
  const listed = mapEntries.filter(
    (e) => isFavorite(e.key) || e.official || e.key === mapKey
  )
  const sortedList = [
    ...listed.filter((e) => isFavorite(e.key)),
    ...listed.filter((e) => !isFavorite(e.key) && e.official),
    // Выбранная карта мода, которой нет в избранном, тоже видна в списке
    ...listed.filter((e) => !isFavorite(e.key) && !e.official),
  ]
  const mapOptions: DropdownOption<string>[] = sortedList.map((e) => ({
    value: e.key,
    label: e.name,
    description: e.author ? (
      <span className="text-[11.5px] opacity-60">{e.author}</span>
    ) : undefined,
    group: isFavorite(e.key)
      ? t('mapPicker.favourites')
      : e.official
        ? t('picker.vanilla')
        : t('picker.current'),
    icon: <MapGlyph />,
    trailing: (
      <span className="flex shrink-0 items-center gap-1.5">
        <img src={e.preview} alt="" loading="lazy" className="h-9 w-9 rounded object-cover" />
        <button
          type="button"
          tabIndex={-1}
          aria-label={isFavorite(e.key) ? t('picker.unfavourite') : t('picker.favourite')}
          title={isFavorite(e.key) ? t('picker.unfavourite') : t('picker.favourite')}
          onClick={(event) => {
            event.stopPropagation()
            toggleFavorite(e.key)
          }}
          className={[
            'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-app-raised-hover',
            isFavorite(e.key) ? 'text-warn' : 'text-app-faint',
          ].join(' ')}
        >
          <FieldIcon name={isFavorite(e.key) ? 'starFilled' : 'star'} className="h-4 w-4" />
        </button>
      </span>
    ),
  }))
  const actionIcon = (name: FieldIconName) => (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text">
      <FieldIcon name={name} className="h-4 w-4" />
    </span>
  )
  mapOptions.push(
    {
      value: MOD_MAPS,
      label: t('picker.mod-maps'),
      description: (
        <span className="text-[11.5px] opacity-60">
          {mapEntries.filter((e) => !e.official).length}
        </span>
      ),
      icon: actionIcon('search'),
      divider: true,
    }
  )

  return (
    <div>
      {!map && (
        <div className="flex aspect-square items-center justify-center rounded-lg bg-app-surface">
          <p className="label">{t('artilleryCalculator.loading-the-map')}</p>
        </div>
      )}

      {map && (
        <div ref={containerRef} data-tour="map" className="relative w-full rounded-lg ring-1 ring-app-line-strong">
          <canvas
            ref={setCanvas}
            width={Math.round(size.width * ratio)}
            height={Math.round(size.height * ratio)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragRef.current = null
              drawRef.current = null
              setLiveStroke(null)
            }}
            onContextMenu={(event) => event.preventDefault()}
            style={{ width: size.width, height: size.height }}
            className="block cursor-crosshair touch-none rounded-lg"
          />

          {flight.length > 0 && flightOnMap && gun && target && (
            <FlightCanvas
              shots={flight}
              category={category}
              kind={shellKind(shellType)}
              ends={flightEnds}
              width={size.width}
              height={size.height}
              className="pointer-events-none absolute top-0 left-0"
            />
          )}

          {/* Справа: что ставит касание, ниже — рисование */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
          <div
            role="toolbar"
            data-tour="tools"
            aria-label={t('mapPicker.tap-places')}
            aria-orientation="vertical"
            className="flex flex-col gap-1 rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm"
          >
            {(
              [
                { id: 'gun', icon: 'gun', label: 'mapPicker.gun', },
                { id: 'target', icon: 'target', label: 'artilleryCalculator.target', },
                ...(showMarkers
                  ? [{ id: 'marker', icon: 'marker', label: 'mapPicker.marker', }]
                  : []),
                { id: 'line', icon: 'line', label: 'mapPicker.fire-line', },
              ] as { id: Placing; icon: FieldIconName; label: MessageKey }[]
            ).map((tool) => {
              const active = placing === tool.id
              const locked = tool.id === 'gun' && gunLocked
              const button = (
                <button
                  type="button"
                  aria-pressed={active}
                  aria-disabled={locked}
                  title={t(tool.label)}
                  aria-label={t(tool.label)}
                  onClick={() => !locked && setPlacing(tool.id)}
                  className={[
                    'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors',
                    locked ? 'opacity-40' : '',
                    active
                      ? 'bg-accent-solid text-white'
                      : 'text-white/80 hover:bg-white/15',
                  ].join(' ')}
                >
                  <FieldIcon name={tool.icon} className="h-5 w-5" />
                </button>
              )
              if (tool.id !== 'gun') return <span key={tool.id}>{button}</span>

              // Орудие: если подержать курсор (или палец) на кнопке, слева
              // выезжает замок. Закреплённое орудие показывает замок всегда.
              return (
                <div
                  key={tool.id}
                  className="relative"
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') startLockHold(450)
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === 'mouse') endLockHold()
                  }}
                  onPointerDown={(event) => {
                    if (event.pointerType !== 'mouse') startLockHold(500)
                  }}
                  onPointerUp={(event) => {
                    if (event.pointerType !== 'mouse') cancelLockTimer()
                  }}
                  onPointerCancel={cancelLockTimer}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {(lockShown || gunLocked) && (
                    <div className="absolute top-0 right-full pr-1.5">
                      <button
                        type="button"
                        aria-pressed={gunLocked}
                        disabled={!gun}
                        title={
                          gunLocked
                            ? t('mapPicker.gun-locked-tap-to-unlock')
                            : t('mapPicker.lock-the-gun-and-its')
                        }
                        aria-label={t('mapPicker.lock-the-gun')}
                        onClick={toggleGunLock}
                        className={[
                          'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg shadow-lg backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                          gunLocked
                            ? 'bg-warn/90 text-black'
                            : 'bg-black/70 text-white/90 hover:bg-black/85',
                        ].join(' ')}
                      >
                        <FieldIcon name={gunLocked ? 'lock' : 'unlock'} className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                  {button}
                </div>
              )
            })}
          </div>

          <div
            role="toolbar"
            aria-label={t('mapPicker.draw-tools')}
            className="flex flex-row-reverse gap-1 rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm"
          >
            <button
              type="button"
              aria-expanded={drawOpen}
              title={t('mapPicker.draw-tools')}
              aria-label={t('mapPicker.draw-tools')}
              onClick={() => {
                if (drawOpen && isDrawTool(placing)) setPlacing('target')
                setDrawOpen(!drawOpen)
              }}
              className={[
                'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors',
                drawOpen || isDrawTool(placing)
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/15',
              ].join(' ')}
            >
              <FieldIcon name={drawOpen ? 'close' : 'pen'} className="h-5 w-5" />
            </button>
            {drawOpen && (
              <div className="flex gap-1">
            {(
              [
                { id: 'pen', icon: 'pen', label: 'mapPicker.draw-pen' },
                { id: 'draw-line', icon: 'drawLine', label: 'mapPicker.draw-line' },
                { id: 'eraser', icon: 'eraser', label: 'mapPicker.draw-eraser' },
              ] as { id: Placing; icon: FieldIconName; label: MessageKey }[]
            ).map((tool) => (
              <button
                key={tool.id}
                type="button"
                aria-pressed={placing === tool.id}
                title={t(tool.label)}
                aria-label={t(tool.label)}
                onClick={() => setPlacing(placing === tool.id ? 'target' : tool.id)}
                className={[
                  'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors',
                  placing === tool.id
                    ? 'bg-accent-solid text-white'
                    : 'text-white/80 hover:bg-white/15',
                ].join(' ')}
              >
                <FieldIcon name={tool.icon} className="h-5 w-5" />
              </button>
            ))}
            <button
              type="button"
              title={t('mapPicker.draw-colour')}
              aria-label={t('mapPicker.draw-colour')}
              onClick={() =>
                setDrawColor(
                  MARKER_COLORS[(MARKER_COLORS.indexOf(drawColor) + 1) % MARKER_COLORS.length]
                )
              }
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-white/15"
            >
              <span
                className="h-5 w-5 rounded-full ring-2 ring-white/70"
                style={{ backgroundColor: MARKER_RGB[drawColor] }}
              />
            </button>
            <button
              type="button"
              disabled={strokes.length === 0}
              title={t('mapPicker.draw-undo')}
              aria-label={t('mapPicker.draw-undo')}
              onClick={() => commitStrokes(strokes.slice(0, -1))}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-white/80 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FieldIcon name="undo" className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={strokes.length === 0}
              title={t('mapPicker.draw-clear')}
              aria-label={t('mapPicker.draw-clear')}
              onClick={() => {
                if (clearArmed) {
                  setClearArmed(false)
                  commitStrokes([])
                } else setClearArmed(true)
              }}
              className={[
                'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-35',
                clearArmed ? 'bg-danger text-white' : 'text-white/80 hover:bg-white/15',
              ].join(' ')}
            >
              <FieldIcon name="trash" className="h-5 w-5" />
            </button>
              </div>
            )}
          </div>
          </div>

          {/* Слева: цели журнала — выбор, экспорт и импорт */}
          <div className="absolute top-2 left-2 flex max-w-[60%] flex-col items-start gap-2">
          {targetActions && (
            <div className="flex flex-col items-start gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-expanded={targetsOpen}
                  onClick={() => setTargetsOpen((v) => !v)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-black/70 px-2.5 text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
                >
                  <FieldIcon name="list" className="h-5 w-5" />
                  {t('mapPicker.targets')}
                  <span className="rounded-full bg-white/20 px-1.5 text-[11.5px]">
                    {quickTargets.length}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={quickTargets.length === 0}
                  title={t('mapPicker.export-targets-to-a-file')}
                  aria-label={t('mapPicker.export-targets')}
                  onClick={targetActions.exportAll}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FieldIcon name="export" className="h-[18px] w-[18px]" />
                </button>
                <button
                  type="button"
                  title={t('mapPicker.import-targets-from-a-file')}
                  aria-label={t('mapPicker.import-targets')}
                  onClick={() => importRef.current?.click()}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
                >
                  <FieldIcon name="import" className="h-[18px] w-[18px]" />
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void targetActions.importFile(file).then(setNotice)
                    event.target.value = ''
                  }}
                />
              </div>
              {targetsOpen && (
                <ul className="max-h-[min(22rem,60%)] w-56 max-w-full overflow-y-auto rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm">
                  {quickTargets.length === 0 && (
                    <li className="px-2 py-1.5 text-[12.5px] text-white/60">
                      {t('mapPicker.empty-so-far-work-out')}
                    </li>
                  )}
                  {quickTargets.map((qt) => (
                    <li key={qt.id} className="group relative">
                      {renamingId === qt.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          maxLength={60}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onBlur={() => {
                            targetActions.rename(qt.id, renameValue)
                            setRenamingId(null)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                            if (event.key === 'Escape') setRenamingId(null)
                          }}
                          className="field m-0.5 h-8 w-[calc(100%-0.25rem)] py-0 text-[13px]"
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-current={qt.active ? 'true' : undefined}
                            onClick={() => onPickJournalTarget?.(qt.id)}
                            className={[
                              'flex w-full cursor-pointer flex-col rounded-md py-1 pr-14 pl-2 text-left transition-colors',
                              qt.active
                                ? 'bg-accent-solid text-white'
                                : 'text-white/90 hover:bg-white/15',
                            ].join(' ')}
                          >
                            <span className="truncate text-[13px] font-medium">{qt.name}</span>
                            <span className="truncate text-[11.5px] tabular-nums opacity-70">
                              {qt.detail}
                            </span>
                          </button>
                          <span className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              type="button"
                              aria-label={t('mapPicker.rename')}
                              title={t('mapPicker.rename')}
                              onClick={() => {
                                setRenamingId(qt.id)
                                setRenameValue(qt.name)
                              }}
                              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/80 hover:bg-white/20"
                            >
                              <FieldIcon name="edit" className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={t('mapPicker.delete')}
                              title={t('mapPicker.delete')}
                              onClick={() => targetActions.remove(qt.id)}
                              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/80 hover:bg-white/20"
                            >
                              <FieldIcon name="trash" className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {showMarkers && (
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                aria-expanded={markersOpen}
                onClick={() => setMarkersOpen((v) => !v)}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-black/70 px-2.5 text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
              >
                <FieldIcon name="marker" className="h-5 w-5" />
                {t('mapPicker.markers')}
                <span className="rounded-full bg-white/20 px-1.5 text-[11.5px]">
                  {markers.length}
                </span>
              </button>
              {markersOpen && (
                <div className="max-h-[min(22rem,60%)] w-64 max-w-full overflow-y-auto rounded-lg bg-black/70 p-2 text-white/90 shadow-lg backdrop-blur-sm">
                  <MarkerList
                    markers={markers}
                    now={now}
                    onTarget={(marker) => placeTarget({ x: marker.x, y: marker.y })}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] text-white/70">
                      {t('mapPicker.marker-by-grid')}
                    </span>
                    <input
                      value={gridDraft}
                      onChange={(event) => setGridDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') addByGrid()
                      }}
                      placeholder="045 078"
                      inputMode="numeric"
                      className="field h-8 w-24 py-0 text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={addByGrid}
                      disabled={!parseGrid(gridDraft)}
                      className={buttonClass}
                    >
                      {t('mapPicker.add')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          {draft && (
            <div className="absolute right-2 bottom-14 left-2 mx-auto flex max-w-md flex-wrap items-center gap-2 rounded-lg bg-black/80 p-2 text-white/90 shadow-lg backdrop-blur-sm">
              <span className="w-full text-[12px] font-medium text-white/70">{t('mapPicker.new-marker')}</span>
              <span className="text-[13px] text-white/70 tabular-nums">
                {toGridReference(draft.point, 8)}
              </span>
              <input
                autoFocus
                value={draft.label}
                maxLength={40}
                placeholder={t('mapPicker.label-optional')}
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
              />
              <button type="button" onClick={saveDraft} className="btn btn-primary">
                {t('mapPicker.place')}
              </button>
              <button type="button" onClick={() => setDraft(null)} className="btn">
                {t('mapPicker.cancel')}
              </button>
            </div>
          )}


          {/* Снизу по центру: координаты орудия и цели */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-lg bg-black/70 px-3 py-2 text-[12.5px] leading-none whitespace-nowrap text-white/90 tabular-nums shadow-lg backdrop-blur-sm">
            <span className="flex items-center gap-2">
              <span className="block h-2 w-2 shrink-0 rounded-full bg-gun" />
              <span>
                {gun
                  ? `${toGridReference(gun, 8)} · ${Math.round(gunHeight ?? 0)} ${unitM}`
                  : t('mapPicker.no-gun')}
              </span>
            </span>
            <FlightTrack shots={flight} />
            <span className="flex items-center gap-2">
              <span>
                {target
                  ? `${toGridReference(target, 8)} · ${Math.round(targetHeight ?? 0)} ${unitM}`
                  : t('mapPicker.no-target')}
              </span>
              <span className="block h-2 w-2 shrink-0 rounded-full bg-target" />
            </span>
          </div>
        </div>
      )}

      {notice && (
        <p className="mt-3 rounded-md bg-app-raised px-3 py-2 text-[13.5px] text-app-text-2" role="status">
          {notice}
        </p>
      )}

      {/* ---- Панель под картой ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {builtin.length > 0 && <MapGlyph big />}
        {builtin.length > 0 && (
          <Dropdown
            tourId="map-select"
            label={t('mapPicker.map')}
            value={mapKey}
            onChange={(key) => (key === MOD_MAPS ? setPickingMod(true) : openMap(key))}
            alignLeft
            placeholder="—"
            buttonLabel={mapLabel(mapKey)}
            options={mapOptions}
          />
        )}
        {map && (
          <>
            <div className="ml-auto flex gap-1">
              <button type="button" className="btn px-3" aria-label="−" onClick={() => zoomAt(1 / 1.6, size.width / 2, size.height / 2)}><FieldIcon name="minus" /></button>
              <button type="button" className="btn px-3" aria-label="+" onClick={() => zoomAt(1.6, size.width / 2, size.height / 2)}><FieldIcon name="plus" /></button>
              <button type="button" className="btn" onClick={() => setView(null)}>
                <FieldIcon name="fit" />
                {t('mapPicker.fit')}
              </button>
            </div>
          </>
        )}
      </div>

      {map && (
        <>
          {(placing === 'line' || linePoints.length > 0) && (
            <div className="mt-3 rounded-lg bg-app-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label">
                  {t('mapPicker.line-fire')}
                </span>
                <Dropdown
                  alignLeft
                  label={t('mapPicker.kill-radius')}
                  value={lineWeaponId}
                  onChange={(id) => {
                    setLineWeaponId(id)
                    setLineIndex(null)
                    writeStored('lineWeapon', id)
                  }}
                  options={LINE_WEAPONS.map((w) => ({
                    value: w.id,
                    label: `${lineWeaponName(w.id)} · ±${w.radius} ${unitM}`,
                  }))}
                />
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={linePoints.length === 0}
                    onClick={() => changeLine(linePoints.slice(0, -1))}
                  >
                    {t('mapPicker.undo-point')}
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={linePoints.length === 0}
                    onClick={() => changeLine([])}
                  >
                    {t('mapPicker.clear')}
                  </button>
                </div>
              </div>

              {linePoints.length === 0 ? (
                <p className="mt-2 text-[13px] text-app-muted">
                  {t('mapPicker.tap-points-along-a-tree')}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[13px] text-app-muted tabular-nums">
                    {t('mapPicker.length')}{' '}
                    {Math.round(polylineLength(linePoints))} {unitM} ·{' '}
                    {t('mapPicker.aim-points')} {lineAim.length}{' '}
                    · {t('mapPicker.spacing')} ≤ {lineWeapon.radius * 2} {unitM}
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
                      {t('mapPicker.place-the-gun-then-one')}
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
                        ← {t('mapPicker.previous')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={lineIndex !== null && lineIndex >= lineAim.length - 1}
                        onClick={() => aimAt(lineIndex === null ? 0 : lineIndex + 1)}
                      >
                        {lineIndex === null
                          ? t('mapPicker.first-point')
                          : t('mapPicker.next')}{' '}
                        →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {showMarkers && showScreenMarkers && (
            <ScreenMarkers world={map.world} author={author} language={language} />
          )}
        </>
      )}
      {pickingMod && (
        <PickerDialog
          title={t('picker.maps-title')}
          placeholder={t('picker.search-maps')}
          selectedId={mapKey}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          items={mapEntries
            .filter((e) => !e.official)
            .map((e) => ({
              id: e.key,
              title: e.name,
              subtitle: e.author,
              thumb: e.preview,
              group: t('picker.mods'),
            }))}
          onPick={(key) => {
            setPickingMod(false)
            openMap(key)
          }}
          onClose={() => setPickingMod(false)}
          footer={
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPickingMod(false)
                setSuggesting(true)
              }}
            >
              <FieldIcon name="plus" className="h-[18px] w-[18px]" />
              {t('picker.suggest')}
            </button>
          }
        />
      )}
      {suggesting && (
        <MapRequests onClose={() => setSuggesting(false)} />
      )}
    </div>
  )
}

function lineWeaponName(id: LineWeapon["id"]): string {
  switch (id) {
    case 'mortar':
      return t('mapPicker.mortar')
    case 'artillery':
      return t('mapPicker.artillery')
    case 'rocket':
      return t('mapPicker.rocket')
    case 'rocket-wide':
      return t('mapPicker.rocket-wide')
  }
}

function ColorPicker({
  value,
  onChange,
}: {
  value: MarkerColor
  onChange: (color: MarkerColor) => void
  
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('mapPicker.colour')}
      className="flex gap-1"
    >
      {MARKER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={t(COLOR_NAMES[color])}
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
  onTarget,
}: {
  markers: MapMarker[]
  now: number
  
  onTarget: (marker: MapMarker) => void
}) {
  if (markers.length === 0) {
    return (
      <p className="mt-3 text-xs text-app-muted">
        {t('mapPicker.no-markers-marker-mode-click')}
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
            {markerTitle(marker)}
            <span className="label ml-2 text-[12.5px]">
              {marker.author}
              {marker.source === 'screen' && (t('mapPicker.from-screen'))}
            </span>
          </span>
          <span className="text-xs text-app-muted">
            {toGridReference(marker, 8)}
          </span>
          <span className="mono-num w-24 text-right text-[12.5px] text-app-muted">
            {formatAge(now - marker.createdAt)}
          </span>
          <button
            type="button"
            onClick={() => onTarget(marker)}
            className="btn btn-sm"
          >
            {t('artilleryCalculator.target')}
          </button>
          <button
            type="button"
            onClick={() => removeMarker(marker.id)}
            aria-label={t('mapPicker.delete-marker')}
            className="cursor-pointer px-1.5 text-app-muted hover:text-danger"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Значок карты слева от названия в списке карт. */
function MapGlyph({ big = false }: { big?: boolean }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text',
        big ? 'h-9 w-9' : 'h-7 w-7',
      ].join(' ')}
    >
      <FieldIcon name="map" className={big ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
    </span>
  )
}

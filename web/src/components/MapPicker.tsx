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
  FIRE_DENSITIES,
  polylineLength,
  recommendedDensity,
  type FireDensity,
} from '../lib/fireLine'
import { readStoredText, writeStored } from '../lib/input'
import {
  drawVector,
  loadVector,
  TOPO_PAPER,
  type MapStyle,
  type MapVector,
} from '../lib/mapVector'
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
  markerRgb,
  markerOpacity,
  useMarkers,
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
import { ColorField } from './ColorWheel'
import { Dropdown, type DropdownOption } from './Dropdown'
import { MapRequests } from './MapRequests'
import { PickerDialog } from './PickerDialog'
import type { JournalActions } from '../lib/journalIO'
import { FieldIcon, type FieldIconName } from './FieldIcon'
import { useFlightOnMap } from '../lib/animation'
import { FlightCanvas, type FlightShot } from './FlightCanvas'
import { useFavorites } from '../lib/favorites'
import { shellKind } from '../lib/shellKind'
import type { ArtilleryCategory } from '../types/gameModel'
import { MAPS_BASE } from '../lib/builtinMaps'
import { ScreenMarkers } from './ScreenMarkers'
import { CoordinatePlate } from './map/CoordinatePlate'
import { DrawToolbar, type DrawTool } from './map/DrawToolbar'
import { MapGlyph } from './map/MapGlyph'
import { MapQualityBadge } from './map/MapQualityBadge'
import { colorName, markerTitle } from './map/mapLabels'
import { MapPointsPanel } from './map/MapPointsPanel'

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
  // Огонь по линии: возвышение в точку при этой дальности и разнице высот
  // (цель минус орудие) тем же способом, что и основной расчёт
  solveLine?: (distance: number, heightDiff: number) => { elevation: number; charge: number } | null
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
  solveLine,
}: Props) {
  const ru = language === 'ru'
  const unitM = t('unit.m')

  const flightOnMap = useFlightOnMap()
  // Избранные карты: ключи пунктов списка, показываются сверху
  const [favorites, toggleFavorite] = useFavorites('favMaps')
  // Встроенные карты (спутник + высоты) и тайлы открытой карты
  const [builtin, setBuiltin] = useState<BuiltinMapEntry[]>([])
  const [tiles, setTiles] = useState<MapTiles | null>(null)
  // Векторный слой (здания, дороги, горизонтали) и стиль карты
  const [vector, setVector] = useState<MapVector | null>(null)
  const [mapStyle, setMapStyle] = useState<MapStyle>(() =>
    readStoredText('mapStyle') === 'topo' ? 'topo' : 'sat'
  )
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

  // Линия огня: ломаная из точек, плотность огня (радиус разрыва) и номер
  // точки прицеливания, по которой стреляют сейчас. Плотность по умолчанию —
  // рекомендуемая для орудия; выбранная вручную запоминается.
  const [linePoints, setLinePoints] = useState<MapPoint[]>([])
  const [densityChoice, setDensityChoice] = useState<FireDensity['id'] | null>(
    () => FIRE_DENSITIES.find((d) => d.id === readStoredText('lineDensity'))?.id ?? null
  )
  const recommendedId = recommendedDensity(category)
  const lineDensity =
    FIRE_DENSITIES.find((d) => d.id === (densityChoice ?? recommendedId)) ?? FIRE_DENSITIES[0]
  const [lineIndex, setLineIndex] = useState<number | null>(null)
  const lineAim = useMemo(
    () => aimPoints(linePoints, lineDensity.radius),
    [linePoints, lineDensity.radius]
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

  // ---- рисунок на карте ----
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const [liveStroke, setLiveStroke] = useState<DrawStroke | null>(null)
  const [drawColor, setDrawColor] = useState<MarkerColor>('red')
  const [drawOpen, setDrawOpen] = useState(false)
  const drawSeq = useRef(0)
  const drawRef = useRef<{ stroke: DrawStroke; erasing: boolean } | null>(null)
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

  // ---- загрузка списка и последней карты ----
  function openMap(key: string) {
    // Старые версии хранили «local:…» и просто имя мира: берём только имя
    const world = key.includes(':') ? key.split(':', 2)[1] : key
    const load = loadBuiltinMap(world).then((result) =>
      result
        ? { heightmap: result.heightmap, tiles: result.tiles, vectorUrl: result.vectorUrl }
        : null
    )
    load
      .then((loaded) => {
        if (!loaded) return
        writeStored('mapWorld', `builtin:${world}`)
        setMapKey(`builtin:${world}`)
        setMap(loaded.heightmap)
        setTiles(loaded.tiles)
        setVector(null)
        if (loaded.vectorUrl) void loadVector(loaded.vectorUrl).then(setVector)
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
  const baseCache = useRef<{ key: string; x0: number; y0: number; scale: number; canvas: HTMLCanvasElement } | null>(null)
  // Пока крутится колесо, основа лишь масштабируется; через 140 мс после последнего шага — чёткая перерисовка
  const [settleTick, setSettleTick] = useState(0)
  const zoomingUntil = useRef(0)
  const settleTimer = useRef<number | null>(null)
  const markZoom = useCallback(() => {
    zoomingUntil.current = performance.now() + 140
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null
      setSettleTick((v) => v + 1)
    }, 160)
  }, [])
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

    // Нет спутника — только топо
    const topo = (mapStyle === 'topo' || tiles === null) && vector !== null
    if (topo) {
      ink.grid = 'rgba(0,0,0,0.14)'
      ink.gridKm = 'rgba(0,0,0,0.34)'
      ink.gridText = 'rgba(0,0,0,0.6)'
    }

    // Основа (фон, рельеф, спутник, векторный слой) рисуется один раз на холст
    // вдвое больше экрана и при перетаскивании только сдвигается: так карта не
    // перерисовывается заново на каждое движение мыши
    const extent = mapExtent(map)
    const half = map.step / 2
    const paintBase = (target: CanvasRenderingContext2D, bx0: number, by0: number, w: number, h: number) => {
      const toPx = (p: MapPoint) => ({ x: (p.x - bx0) * scale, y: (by0 - p.y) * scale })
      target.setTransform(ratio, 0, 0, ratio, 0, 0)
      target.fillStyle = topo ? TOPO_PAPER : ink.bg
      target.fillRect(0, 0, w, h)
      target.imageSmoothingEnabled = true
      if (!topo) {
        // Пиксель изображения i — узел x = i·step, покрывает ±step/2
        // Рисуем только видимый кусок рельефа: целиком он при сильном приближении огромен
        const total = extent + map.step
        const u0 = Math.max(0, bx0 + half)
        const u1 = Math.min(total, bx0 + w / scale + half)
        const v0 = Math.max(0, extent + half - by0)
        const v1 = Math.min(total, extent + half - (by0 - h / scale))
        if (u1 > u0 && v1 > v0) {
          target.drawImage(
            relief,
            (u0 / total) * relief.width,
            (v0 / total) * relief.height,
            ((u1 - u0) / total) * relief.width,
            ((v1 - v0) / total) * relief.height,
            (u0 - half - bx0) * scale,
            (by0 - (extent + half - v0)) * scale,
            (u1 - u0) * scale,
            (v1 - v0) * scale
          )
        }
      }
      // Спутниковый снимок поверх рельефа: пока тайл грузится, виден рельеф
      if (tiles && !topo) {
        const z = tileLevel(tiles, scale * ratio)
        const visible = visibleTiles(tiles, z, {
          minX: bx0,
          maxX: bx0 + w / scale,
          minY: by0 - h / scale,
          maxY: by0,
        })
        for (const tile of visible) {
          const image = tileImage(tile.url)
          if (!image.complete || image.naturalWidth === 0) continue
          const p = toPx({ x: tile.x, y: tile.y })
          // +0.5 px — без щелей между тайлами при дробном масштабе
          const side = tile.meters * scale + 0.5
          target.drawImage(image, p.x, p.y, side, side)
        }
      }
      // Здания, дороги, горизонтали: поверх спутника — при сильном приближении
      if (vector) {
        drawVector(target, vector, { x0: bx0, y0: by0, scale, width: w, height: h }, topo ? 'topo' : 'sat', sans)
      }
    }

    const cacheKey = [map.world, topo, night, ratio, size.width, size.height, tileTick, vector ? 1 : 0].join('|')
    let cache = baseCache.current
    const w2 = size.width * 2
    const h2 = size.height * 2
    const sameScene = cache !== null && cache.key === cacheKey
    const inside =
      sameScene &&
      cache!.scale === scale &&
      x0 >= cache!.x0 &&
      x0 + size.width / scale <= cache!.x0 + w2 / scale &&
      y0 <= cache!.y0 &&
      y0 - size.height / scale >= cache!.y0 - h2 / scale
    // Зум: пока колесо крутится, старая основа просто масштабируется (дёшево),
    // а настоящая перерисовка — когда зум остановился
    const zoomRatio = sameScene ? scale / cache!.scale : 1
    const stretch =
      sameScene && !inside && cache!.scale !== scale && zoomRatio > 0.55 && zoomRatio < 1.8 && performance.now() < zoomingUntil.current
    if (stretch) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.fillStyle = topo ? TOPO_PAPER : ink.bg
      ctx.fillRect(0, 0, size.width, size.height)
      // Точка кэша (cache.x0, cache.y0) после смены масштаба
      ctx.drawImage(
        cache!.canvas,
        (cache!.x0 - x0) * scale,
        (y0 - cache!.y0) * scale,
        w2 * zoomRatio,
        h2 * zoomRatio
      )
    } else if (!inside) {
      const surface = cache?.canvas ?? document.createElement('canvas')
      surface.width = Math.round(w2 * ratio)
      surface.height = Math.round(h2 * ratio)
      const sctx = surface.getContext('2d')
      if (!sctx) return
      // Экран лежит в середине холста основы
      const bx0 = x0 - size.width / 2 / scale
      const by0 = y0 + size.height / 2 / scale
      paintBase(sctx, bx0, by0, w2, h2)
      cache = { key: cacheKey, x0: bx0, y0: by0, scale, canvas: surface }
      baseCache.current = cache
    }
    if (!stretch) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.drawImage(
      cache!.canvas,
      Math.round((cache!.x0 - x0) * scale * ratio) / ratio,
      Math.round((y0 - cache!.y0) * scale * ratio) / ratio,
      w2,
      h2
    )
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
      ctx.strokeStyle = markerRgb(stroke.color)
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
      ctx.fillStyle = markerRgb(marker.color)
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
      ctx.fillStyle = markerRgb(marker.color)
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
      ctx.strokeStyle = markerRgb(draft.color)
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
        ctx.lineWidth = Math.max(4, lineDensity.radius * 2 * scale)
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
  }, [canvas, map, relief, activeView, gun, target, size, unitM, ratio, markers, now, draft, ru, night, journalTargets, tiles, tileTick, linePoints, lineAim, lineIndex, lineDensity, reach, strokes, liveStroke, vector, mapStyle, settleTick])

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
    markZoom()
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

  const panRef = useRef<View | null>(null)
  const panFrame = useRef<number | null>(null)

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
    // Не чаще одного обновления на кадр: мышь шлёт события чаще экрана
    panRef.current = {
      scale: drag.view.scale,
      x0: drag.view.x0 - dx / drag.view.scale,
      y0: drag.view.y0 + dy / drag.view.scale,
    }
    if (panFrame.current === null) {
      panFrame.current = requestAnimationFrame(() => {
        panFrame.current = null
        if (panRef.current) setView(panRef.current)
      })
    }
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

  // Огонь по линии: возвышение и азимут в каждую точку прицеливания
  const lineRows = useMemo(() => {
    if (!map || !gun) return []
    const own = heightAt(map, gun) ?? 0
    return lineAim.map((point) => {
      const line = bearing(gun, point)
      const height = heightAt(map, point) ?? own
      return { azimuthMil: line.azimuthMil, solved: solveLine?.(line.distance, height - own) ?? null }
    })
  }, [map, gun, lineAim, solveLine])
  // Заряд показывается, только если по линии он меняется
  const lineMixedCharges =
    new Set(lineRows.flatMap((row) => (row.solved ? [row.solved.charge] : []))).size > 1

  const gunHeight = map && gun ? heightAt(map, gun) : null
  const targetHeight = map && target ? heightAt(map, target) : null

  const buttonClass = 'btn btn-sm'


  // ---- список карт: ванильные — в списке, карты модов — в окне с поиском ----
  const MOD_MAPS = '__mods__'
  const mapEntries = builtin.map((m) => ({
    key: `builtin:${m.world}`,
    name: m.names?.[language] ?? m.displayName,
    author: m.author,
    kind: mapKind(m),
    official: mapKind(m) === 'official',
    lowQuality: m.quality === 'low',
    preview: `${MAPS_BASE}${m.world}/preview.webp`,
  }))
  const current = mapEntries.find((e) => e.key === mapKey)
  function mapLabel(key: string): string {
    return mapEntries.find((e) => e.key === key)?.name ?? '-'
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
        {e.lowQuality && <MapQualityBadge />}
        {mapOptionTrailing(e)}
      </span>
    ),
  }))
  function mapOptionTrailing(e: (typeof mapEntries)[number]) {
    return (
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
    )
  }
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

          <DrawToolbar
            tool={isDrawTool(placing) ? (placing as DrawTool) : null}
            onTool={(tool) => setPlacing(tool ?? 'target')}
            open={drawOpen}
            onOpenChange={setDrawOpen}
            color={drawColor}
            onColor={setDrawColor}
            canUndo={strokes.length > 0}
            onUndo={() => commitStrokes(strokes.slice(0, -1))}
            onClear={() => commitStrokes([])}
          />
          </div>

          {/* Слева: один список «Метки» (сохранённые цели и метки) */}
          {(targetActions || showMarkers) && (
            <div className="absolute top-2 left-2 flex max-w-[60%] flex-col items-start gap-2">
              <MapPointsPanel
                targets={quickTargets}
                actions={targetActions}
                onPickTarget={onPickJournalTarget}
                markers={showMarkers ? markers : null}
                now={now}
                onTargetMarker={(marker) => placeTarget({ x: marker.x, y: marker.y })}
                onAddByGrid={(point) => setDraft({ point, label: '', color: markerColor })}
                onNotice={setNotice}
                shared={sync.enabled}
              />
            </div>
          )}

          {draft && (
            <div
              role="dialog"
              aria-label={t('mapPicker.new-marker')}
              className="absolute right-2 bottom-2 left-2 z-20 mx-auto flex max-h-[calc(100%-1rem)] max-w-sm flex-col gap-2.5 overflow-y-auto rounded-xl bg-black/85 p-3 text-white/90 shadow-lg backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rotate-45"
                  style={{ backgroundColor: markerRgb(draft.color) }}
                />
                <span className="text-[14px] font-semibold">{t('mapPicker.new-marker')}</span>
                <span className="ml-auto text-[13px] text-white/70 tabular-nums">
                  {toGridReference(draft.point, 8)}
                </span>
              </div>
              <input
                autoFocus
                value={draft.label}
                maxLength={40}
                placeholder={t('mapPicker.label-optional')}
                aria-label={t('mapPicker.label-optional')}
                onChange={(event) =>
                  setDraft({ ...draft, label: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveDraft()
                  if (event.key === 'Escape') setDraft(null)
                }}
                className="field w-full"
              />
              <ColorField
                inline
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
                names={colorName}
              />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDraft(null)} className="btn">
                  {t('mapPicker.cancel')}
                </button>
                <button type="button" onClick={saveDraft} className="btn btn-primary">
                  {t('mapPicker.place')}
                </button>
              </div>
            </div>
          )}


          {/* Справа снизу: слой карты (спутник / топо); значок — текущий режим */}
          {vector && tiles && (
            <button
              type="button"
              aria-pressed={mapStyle === 'topo'}
              title={mapStyle === 'topo' ? t('mapPicker.style-sat') : t('mapPicker.style-topo')}
              aria-label={mapStyle === 'topo' ? t('mapPicker.style-sat') : t('mapPicker.style-topo')}
              onClick={() => {
                const next = mapStyle === 'topo' ? 'sat' : 'topo'
                setMapStyle(next)
                writeStored('mapStyle', next)
              }}
              className="absolute right-2 bottom-2 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white/90 shadow-lg backdrop-blur-sm transition-colors hover:bg-black/85"
            >
              <FieldIcon
                key={mapStyle}
                name={mapStyle === 'topo' ? 'topo' : 'satellite'}
                className="theme-icon h-5 w-5"
              />
            </button>
          )}

          {/* Снизу по центру: координаты орудия и цели */}
          <CoordinatePlate
            gun={gun}
            gunHeight={gunHeight}
            target={target}
            targetHeight={targetHeight}
            unit={unitM}
            flight={flight}
          />
        </div>
      )}

      {notice && (
        <p className="mt-3 rounded-md bg-app-raised px-3 py-2 text-[13.5px] text-app-text-2" role="status">
          {notice}
        </p>
      )}

      {/* ---- Панель под картой: список карт тянется, кнопки масштаба справа ---- */}
      <div className="mt-3 flex items-center gap-1.5 sm:gap-2">
        {builtin.length > 0 && <MapGlyph big />}
        {builtin.length > 0 && (
          <Dropdown
            tourId="map-select"
            label={t('mapPicker.map')}
            value={mapKey}
            onChange={(key) => (key === MOD_MAPS ? setPickingMod(true) : openMap(key))}
            alignLeft
            fullWidth
            className="min-w-0 flex-1"
            buttonClassName="max-sm:pl-2.5"
            placeholder="-"
            buttonLabel={
              current?.lowQuality ? (
                <span className="flex items-center gap-1.5">
                  <MapQualityBadge inline />
                  {mapLabel(mapKey)}
                </span>
              ) : (
                mapLabel(mapKey)
              )
            }
            options={mapOptions}
          />
        )}
        {map && (
          <>
            <button type="button" className="btn shrink-0 px-3 max-sm:w-9 max-sm:px-0" aria-label="−" onClick={() => zoomAt(1 / 1.6, size.width / 2, size.height / 2)}><FieldIcon name="minus" /></button>
            <button type="button" className="btn shrink-0 px-3 max-sm:w-9 max-sm:px-0" aria-label="+" onClick={() => zoomAt(1.6, size.width / 2, size.height / 2)}><FieldIcon name="plus" /></button>
            <button
              type="button"
              className="btn shrink-0 max-sm:w-9 max-sm:px-0"
              title={t('mapPicker.fit')}
              aria-label={t('mapPicker.fit')}
              onClick={() => setView(null)}
            >
              <FieldIcon name="fit" />
              <span className="max-sm:hidden">{t('mapPicker.fit')}</span>
            </button>
          </>
        )}
      </div>

      {map && (
        <>
          {(placing === 'line' || linePoints.length > 0) && (
            <div className="mt-3 rounded-lg bg-app-surface p-3">
              {/* Заголовок и действия с линией */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2 font-semibold text-app-text">
                  <FieldIcon name="drawLine" className="h-[18px] w-[18px] text-app-muted" />
                  {t('mapPicker.line-fire')}
                </span>
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    className={`${buttonClass} max-sm:h-8 max-sm:w-8 max-sm:px-0`}
                    title={t('mapPicker.undo-point')}
                    aria-label={t('mapPicker.undo-point')}
                    disabled={linePoints.length === 0}
                    onClick={() => changeLine(linePoints.slice(0, -1))}
                  >
                    <FieldIcon name="undo" className="h-4 w-4" />
                    <span className="max-sm:hidden">{t('mapPicker.undo-point')}</span>
                  </button>
                  <button
                    type="button"
                    className={`${buttonClass} max-sm:h-8 max-sm:w-8 max-sm:px-0`}
                    title={t('mapPicker.clear')}
                    aria-label={t('mapPicker.clear')}
                    disabled={linePoints.length === 0}
                    onClick={() => changeLine([])}
                  >
                    <FieldIcon name="trash" className="h-4 w-4" />
                    <span className="max-sm:hidden">{t('mapPicker.clear')}</span>
                  </button>
                </div>
              </div>

              {/* Плотность огня; рекомендуемая подходит текущему орудию */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[13.5px] text-app-muted">{t('mapPicker.fire-density')}</span>
                <Dropdown
                  alignLeft
                  fullWidth
                  className="min-w-0 flex-1 basis-60"
                  label={t('mapPicker.fire-density')}
                  value={lineDensity.id}
                  onChange={(id) => {
                    setDensityChoice(id === recommendedId ? null : id)
                    setLineIndex(null)
                    writeStored('lineDensity', id === recommendedId ? '' : id)
                  }}
                  buttonLabel={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {densityLabel(lineDensity, unitM)}
                      {lineDensity.id === recommendedId && (
                        <span className="rounded bg-accent-soft px-1.5 text-[12px] font-medium text-accent">
                          {t('mapPicker.recommended')}
                        </span>
                      )}
                    </span>
                  }
                  options={FIRE_DENSITIES.map((d) => ({
                    value: d.id,
                    label: densityLabel(d, unitM),
                    description:
                      d.id === recommendedId
                        ? `${t('mapPicker.recommended')}: ${t('mapPicker.density-for-weapon')}`
                        : `${t('mapPicker.burst')} ±${d.radius} ${unitM}`,
                  }))}
                />
              </div>

              {linePoints.length === 0 ? (
                <p className="mt-2 text-[13px] text-app-muted">
                  {t('mapPicker.tap-points-along-a-tree')}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[13px] text-app-muted tabular-nums">
                    {t('mapPicker.length')} {Math.round(polylineLength(linePoints))} {unitM} ·{' '}
                    {t('mapPicker.aim-points')} {lineAim.length}
                  </p>
                  {!gun ? (
                    <p className="mt-2 text-[13px] text-app-muted">
                      {t('mapPicker.place-the-gun-then-one')}
                    </p>
                  ) : (
                    <>
                      {/* Текущая точка крупно; стрелки — соседние точки */}
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-app-raised p-2">
                        <button
                          type="button"
                          className="btn h-11 w-11 shrink-0 px-0"
                          aria-label={t('mapPicker.previous')}
                          title={t('mapPicker.previous')}
                          disabled={lineIndex === null || lineIndex <= 0}
                          onClick={() => aimAt((lineIndex ?? 1) - 1)}
                        >
                          <FieldIcon name="arrowLeft" className="h-5 w-5" />
                        </button>
                        <div className="min-w-0 flex-1 text-center">
                          {lineIndex === null ? (
                            <button type="button" className="btn btn-primary" onClick={() => aimAt(0)}>
                              {t('mapPicker.first-point')}
                            </button>
                          ) : (
                            <>
                              <p className="text-[12.5px] text-app-muted">
                                {t('mapPicker.point-of', lineIndex + 1, lineAim.length)}
                                {lineMixedCharges &&
                                  lineRows[lineIndex]?.solved &&
                                  ` · ${t('artilleryCalculator.charge')} ${lineRows[lineIndex].solved.charge}`}
                              </p>
                              <LineSolution row={lineRows[lineIndex]} />
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary h-11 w-11 shrink-0 px-0"
                          aria-label={t('mapPicker.next')}
                          title={t('mapPicker.next')}
                          disabled={lineIndex !== null && lineIndex >= lineAim.length - 1}
                          onClick={() => aimAt(lineIndex === null ? 0 : lineIndex + 1)}
                        >
                          <FieldIcon name="arrowRight" className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Все точки: нажатие наводит на точку */}
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg bg-app-raised/40">
                        <div
                          className={[
                            'sticky top-0 z-10 grid gap-2 bg-app-surface px-2.5 py-1.5 text-[12px] text-app-muted',
                            lineMixedCharges ? 'grid-cols-[2.25rem_1fr_1fr_3.5rem]' : 'grid-cols-[2.25rem_1fr_1fr]',
                          ].join(' ')}
                        >
                          <span>№</span>
                          <span className="text-right">{t('artilleryCalculator.elevation')}</span>
                          <span className="text-right">{t('artilleryCalculator.azimuth')}</span>
                          {lineMixedCharges && <span className="text-right">{t('artilleryCalculator.charge')}</span>}
                        </div>
                        <ul>
                          {lineRows.map((row, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => aimAt(i)}
                                aria-pressed={lineIndex === i}
                                title={toGridReference(lineAim[i], 8)}
                                className={[
                                  'grid w-full cursor-pointer gap-2 px-2.5 py-1.5 text-left text-[14px] tabular-nums transition-colors',
                                  lineMixedCharges ? 'grid-cols-[2.25rem_1fr_1fr_3.5rem]' : 'grid-cols-[2.25rem_1fr_1fr]',
                                  lineIndex === i ? 'bg-accent-soft text-app-text' : 'text-app-text-2 hover:bg-app-raised-hover',
                                ].join(' ')}
                              >
                                <b className="text-app-text">{i + 1}</b>
                                <span className="text-right font-medium text-app-text" title={row.solved ? undefined : t('mapPicker.out-of-range')}>
                                  {row.solved ? Math.round(row.solved.elevation) : '-'}
                                </span>
                                <span className="text-right">{Math.round(row.azimuthMil)}</span>
                                {lineMixedCharges && (
                                  <span className="text-right">{row.solved ? row.solved.charge : '-'}</span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
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
              group: e.kind === 'dlc' ? t('picker.dlc') : t('picker.mods'),
              source: e.kind === 'dlc' ? ('dlc' as const) : ('mod' as const),
              badge: e.lowQuality ? <MapQualityBadge /> : undefined,
            }))
            // DLC — первыми
            .sort((a, b) => (a.source === b.source ? 0 : a.source === 'dlc' ? -1 : 1))}
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

/** «Плотная · шаг 30 м»: название плотности и шаг между точками прицеливания. */
function densityLabel(density: FireDensity, unitM: string): string {
  const names: Record<FireDensity['id'], string> = {
    dense: t('mapPicker.density-dense'),
    medium: t('mapPicker.density-medium'),
    sparse: t('mapPicker.density-sparse'),
    'very-sparse': t('mapPicker.density-very-sparse'),
  }
  return `${names[density.id]} · ${t('mapPicker.spacing')} ${density.radius * 2} ${unitM}`
}

/** Возвышение и азимут в точку линии крупно. */
function LineSolution({
  row,
}: {
  row: { azimuthMil: number; solved: { elevation: number; charge: number } | null } | undefined
}) {
  if (!row) return null
  const mil = <span className="text-[13px] font-normal text-app-muted"> {t('unit.mil')}</span>
  return (
    <div className="mt-1 grid grid-cols-2 gap-2 tabular-nums">
      <div className="min-w-0">
        <p className="text-[12px] text-app-muted">{t('artilleryCalculator.elevation')}</p>
        {row.solved ? (
          <p className="text-[22px] leading-tight font-semibold whitespace-nowrap text-app-text">
            {Math.round(row.solved.elevation)}
            {mil}
          </p>
        ) : (
          <p className="text-[14px] leading-[1.9] text-warn">{t('mapPicker.out-of-range')}</p>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] text-app-muted">{t('artilleryCalculator.azimuth')}</p>
        <p className="text-[22px] leading-tight font-semibold whitespace-nowrap text-app-text">
          {Math.round(row.azimuthMil)}
          {mil}
        </p>
      </div>
    </div>
  )
}

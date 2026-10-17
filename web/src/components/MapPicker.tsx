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
  tileLevel,
  visibleTiles,
  type BuiltinMapEntry,
  type MapTiles,
} from '../lib/builtinMaps'
import { themeColor, useIsDark } from '../lib/useTheme'
import type { Language } from '../types/settings'
import { Toggle } from './FormControls'
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

interface Props {
  language: Language
  onApply: (selection: MapSelection) => void
  // Цели журнала: показываются на карте, клик — загрузить цель
  journalTargets?: readonly JournalMapTarget[]
  onPickJournalTarget?: (id: string) => void
  // Точка текущей цели (например, загруженной из журнала)
  currentTarget?: MapTarget | null
}

interface View {
  // Мировые координаты левого верхнего угла холста, м
  x0: number
  y0: number
  // Пикселей на метр
  scale: number
}

type Placing = 'gun' | 'target' | 'marker'

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
      map
        ? allMarkers
            .filter((m) => m.world === map.world || m.world === '')
            .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [allMarkers, map]
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
  }, [canvas, map, relief, activeView, gun, target, size, unitM, ratio, markers, now, draft, ru, night, journalTargets, tiles, tileTick])

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

  function placeGun(point: MapPoint) {
    if (!map) return
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
    const action: Placing =
      mouse && event.button === 2
        ? 'target'
        : mouse && placing === 'target'
          ? 'gun'
          : placing

    if (action === 'marker') {
      setDraft({ point, label: '', color: markerColor })
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
        <div ref={containerRef} className="w-full">
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
          <select
            aria-label={ru ? 'Карта' : 'Map'}
            value={mapKey}
            onChange={(event) => openMap(event.target.value)}
            className="field w-auto"
          >
            {!map && <option value="">—</option>}
            {builtin.map((m) => (
              <option key={`builtin:${m.world}`} value={`builtin:${m.world}`}>
                {m.displayName}
              </option>
            ))}
            {maps.map((m) => (
              <option key={`local:${m.world}`} value={`local:${m.world}`}>
                {m.world} · {ru ? 'свои высоты' : 'own heights'}
              </option>
            ))}
          </select>
        )}
        {(maps.length > 0 || builtin.length > 0) && !adding && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            {ru ? '+ Карта' : '+ Map'}
          </button>
        )}
        {map && !adding && (
          <>
            <Toggle
              label={ru ? 'Что ставит касание' : 'Tap places'}
              value={placing}
              onChange={setPlacing}
              options={[
                { value: 'gun', label: ru ? 'орудие' : 'gun' },
                { value: 'target', label: ru ? 'цель' : 'target' },
                { value: 'marker', label: ru ? 'метка' : 'marker' },
              ]}
            />
            <div className="ml-auto flex gap-1">
              <button type="button" className="btn px-3" aria-label="−" onClick={() => zoomAt(1 / 1.6, size.width / 2, size.height / 2)}>−</button>
              <button type="button" className="btn px-3" aria-label="+" onClick={() => zoomAt(1.6, size.width / 2, size.height / 2)}>+</button>
              <button type="button" className="btn" onClick={() => setView(null)}>
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

          <details className="disclosure panel mt-3 p-4">
            <summary>
              {ru ? 'Метки' : 'Markers'}
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

          <ScreenMarkers world={map.world} author={author} language={language} />

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

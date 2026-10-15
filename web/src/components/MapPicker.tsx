import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import exportScript from '../data/export-heightmap.sqf?raw'
import { milToDeg } from '../lib/ballistics'
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
import { formatSigned, readStoredText, writeStored } from '../lib/input'
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
import type { AngleUnit } from '../lib/journal'
import {
  deleteHeightmap,
  listHeightmaps,
  loadHeightmap,
  saveHeightmap,
  type StoredMapInfo,
} from '../lib/mapStore'
import { renderRelief, type ReliefPalette } from '../lib/relief'
import { themeColor, useIsDark } from '../lib/useTheme'
import type { Language } from '../types/settings'
import { Toggle } from './FormControls'
import { ScreenMarkers } from './ScreenMarkers'

export interface MapSelection {
  distance: number
  azimuthMil: number
  ownHeight: number
  targetHeight: number
}

interface Props {
  azimuthUnit: AngleUnit
  language: Language
  onApply: (selection: MapSelection) => void
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
export function MapPicker({ azimuthUnit, language, onApply }: Props) {
  const ru = language === 'ru'
  const unitM = ru ? 'м' : 'm'

  const [maps, setMaps] = useState<StoredMapInfo[]>([])
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
  function openMap(world: string) {
    loadHeightmap(world)
      .then((loaded) => {
        if (!loaded) return
        writeStored('mapWorld', world)
        setMap(loaded)
        setGun(readGun(world))
        setTarget(null)
        setPlacing(readGun(world) ? 'target' : 'gun')
        setView(null)
        setAdding(false)
      })
      .catch(() =>
        setNotice(ru ? 'Не удалось открыть карту.' : 'Could not open the map.')
      )
  }

  useEffect(() => {
    listHeightmaps()
      .then((list) => {
        setMaps(list)
        const last = readStoredText('mapWorld')
        const world = list.find((m) => m.world === last)?.world ?? list[0]?.world
        if (world) openMap(world)
      })
      .catch(() => {
        // IndexedDB недоступна — карта не сохранится, но загрузить можно
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
    writeStored('mapWorld', parsed.world)
    setMap(parsed)
    setGun(readGun(parsed.world))
    setTarget(null)
    setPlacing(readGun(parsed.world) ? 'target' : 'gun')
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
    if (!map) return
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
    setGun(null)
    setTarget(null)
  }

  // ---- размер холста ----
  // Ширина контейнера: сразу при появлении и при каждом изменении
  const containerRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    const measure = () => {
      const width = Math.floor(element.getBoundingClientRect().width)
      setSize({ width, height: Math.min(width, 560) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Чёткость на экранах с масштабированием
  const ratio = window.devicePixelRatio || 1

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
    const accent = themeColor('--color-accent') || '#ff5a1f'
    const ink = night
      ? {
          bg: '#0a0a0a',
          grid: 'rgba(255,255,255,0.09)',
          gridKm: 'rgba(255,255,255,0.22)',
          gridText: 'rgba(255,255,255,0.5)',
          plate: 'rgba(10,10,10,0.85)',
          text: '#ebebeb',
          gun: '#ebebeb',
          outline: '#0a0a0a',
        }
      : {
          bg: '#eceae4',
          grid: 'rgba(0,0,0,0.16)',
          gridKm: 'rgba(0,0,0,0.38)',
          gridText: 'rgba(0,0,0,0.65)',
          plate: 'rgba(255,255,255,0.9)',
          text: '#121212',
          gun: '#121212',
          outline: '#ffffff',
        }
    const mono = "'JetBrains Mono Variable', ui-monospace, monospace"
    const sans = "'Inter Tight Variable', system-ui, sans-serif"

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
      ctx.strokeStyle = accent
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])

      const label = `${Math.round(bearing(gun, target).distance)} ${unitM}`
      ctx.font = `12px ${mono}`
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const width = ctx.measureText(label).width
      ctx.fillStyle = ink.plate
      ctx.fillRect(mx - width / 2 - 5, my - 10, width + 10, 20)
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.strokeRect(mx - width / 2 - 4.5, my - 9.5, width + 9, 19)
      ctx.fillStyle = ink.text
      ctx.fillText(label, mx - width / 2, my + 4)
    }

    if (gun) {
      const p = toScreen(gun)
      // Орудие — квадрат со светлой рамкой
      ctx.fillStyle = ink.gun
      ctx.strokeStyle = ink.outline
      ctx.lineWidth = 2
      ctx.fillRect(p.x - 6, p.y - 6, 12, 12)
      ctx.strokeRect(p.x - 6, p.y - 6, 12, 12)
      ctx.fillStyle = accent
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
    }

    if (target) {
      const p = toScreen(target)
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
      ctx.moveTo(p.x - 13, p.y)
      ctx.lineTo(p.x + 13, p.y)
      ctx.moveTo(p.x, p.y - 13)
      ctx.lineTo(p.x, p.y + 13)
      ctx.stroke()
    }
  }, [canvas, map, relief, activeView, gun, target, size, unitM, ratio, markers, now, draft, ru, night])

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

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved || !map) return

    const rect = event.currentTarget.getBoundingClientRect()
    const point = {
      x: drag.view.x0 + (event.clientX - rect.left) / drag.view.scale,
      y: drag.view.y0 - (event.clientY - rect.top) / drag.view.scale,
    }
    if (!isInside(map, point)) return

    if (placing === 'marker') {
      setDraft({ point, label: '', color: markerColor })
      return
    }

    // Клик по метке — цель ставится точно в неё
    const hit = markers.find(
      (m) =>
        Math.hypot(m.x - point.x, m.y - point.y) * drag.view.scale <=
        MARKER_HIT_PX
    )
    if (hit && placing === 'target') {
      setTarget({ x: hit.x, y: hit.y })
      return
    }

    if (placing === 'gun') {
      setGun(point)
      writeStored(`mapGun:${map.world}`, JSON.stringify(point))
      setPlacing('target')
    } else {
      setTarget(point)
    }
  }

  // ---- результат ----
  const gunHeight = map && gun ? heightAt(map, gun) : null
  const targetHeight = map && target ? heightAt(map, target) : null
  const line = gun && target ? bearing(gun, target) : null

  function formatAzimuth(mil: number) {
    return azimuthUnit === 'mil'
      ? `${Math.round(mil)} ${ru ? 'мил' : 'mil'}`
      : `${milToDeg(mil).toFixed(1)}°`
  }

  function apply() {
    if (!line || gunHeight === null || targetHeight === null) return
    onApply({
      distance: line.distance,
      azimuthMil: line.azimuthMil,
      ownHeight: gunHeight,
      targetHeight,
    })
    setNotice(ru ? 'Подставлено в калькулятор.' : 'Applied to the calculator.')
  }

  const buttonClass = 'btn btn-sm'

  const showLoader = adding || !map

  return (
    <div className="mt-5 border border-app-border bg-app-bg p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label flex items-center gap-2 text-app-text">
          {ru ? 'Карта и метки' : 'Map and markers'}
          <span className="tag tag-warn">
            {ru ? 'эксперимент' : 'experimental'}
          </span>
        </p>

        {maps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={ru ? 'Карта' : 'Map'}
              value={map?.world ?? ''}
              onChange={(event) => openMap(event.target.value)}
              className="field w-auto py-1 font-mono text-[11px]"
            >
              {!map && <option value="">—</option>}
              {maps.map((m) => (
                <option key={m.world} value={m.world}>
                  {m.world} · {m.step} {unitM}
                </option>
              ))}
            </select>
            <button type="button" className={buttonClass} onClick={() => setAdding((v) => !v)}>
              {ru ? 'Добавить карту' : 'Add map'}
            </button>
            {map && (
              <button type="button" className={buttonClass} onClick={() => void removeMap()}>
                {ru ? 'Удалить' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>

      {notice && (
        <p className="mt-2 border-l-2 border-accent pl-2 text-xs text-app-text" role="status">
          {notice}
        </p>
      )}

      {showLoader && (
        <div className="mt-3 space-y-3 text-sm text-app-muted">
          <ol className="list-decimal space-y-1 pl-5">
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
            <li>
              <button type="button" className={buttonClass} onClick={() => void pasteFromClipboard()}>
                {ru ? 'Вставить высоты из буфера' : 'Paste heights from clipboard'}
              </button>
              <span className="mx-2">{ru ? 'или' : 'or'}</span>
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
            className="field text-xs"
          />
          <p className="text-xs">
            {ru
              ? 'Карта рисуется из высот: чужие изображения карт не нужны. Высоты хранятся только в этом браузере.'
              : 'The map is drawn from the heights, no map images needed. Heights are stored only in this browser.'}
          </p>
        </div>
      )}

      {map && !adding && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Toggle
              label={ru ? 'Что ставить кликом' : 'Click places'}
              value={placing}
              onChange={setPlacing}
              options={[
                { value: 'gun', label: ru ? 'орудие' : 'gun' },
                { value: 'target', label: ru ? 'цель' : 'target' },
                { value: 'marker', label: ru ? 'метка' : 'marker' },
              ]}
            />
            <div className="flex gap-1">
              <button type="button" className={buttonClass} aria-label="+" onClick={() => zoomAt(1.6, size.width / 2, size.height / 2)}>+</button>
              <button type="button" className={buttonClass} aria-label="−" onClick={() => zoomAt(1 / 1.6, size.width / 2, size.height / 2)}>−</button>
              <button type="button" className={buttonClass} onClick={() => setView(null)}>
                {ru ? 'Вся карта' : 'Fit'}
              </button>
            </div>
          </div>

          <div ref={containerRef} className="mt-2 w-full">
            <canvas
              ref={setCanvas}
              width={Math.round(size.width * ratio)}
              height={Math.round(size.height * ratio)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (dragRef.current = null)}
              style={{ width: size.width, height: size.height }}
              className="block cursor-crosshair touch-none border border-app-border"
            />
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="label inline">{ru ? 'Орудие' : 'Gun'} </dt>
              <dd className="inline font-mono text-app-text">
                {gun ? `${toGridReference(gun)} · ${Math.round(gunHeight ?? 0)} ${unitM}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="label inline">{ru ? 'Цель' : 'Target'} </dt>
              <dd className="inline font-mono text-app-text">
                {target ? `${toGridReference(target)} · ${Math.round(targetHeight ?? 0)} ${unitM}` : '—'}
              </dd>
            </div>
          </dl>

          {draft && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border border-accent bg-app-surface p-2">
              <span className="font-mono text-xs text-app-muted">
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
                className="field min-w-0 flex-1 py-1 text-sm"
              />
              <ColorPicker
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
                language={language}
              />
              <button
                type="button"
                onClick={saveDraft}
                className="btn btn-primary btn-sm"
              >
                {ru ? 'Поставить' : 'Place'}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className={buttonClass}
              >
                {ru ? 'Отмена' : 'Cancel'}
              </button>
            </div>
          )}

          {line && gunHeight !== null && targetHeight !== null && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="mono-num text-sm text-app-text">
                {Math.round(line.distance)} {unitM} · {formatAzimuth(line.azimuthMil)} · ΔH{' '}
                {formatSigned(targetHeight - gunHeight, 0)} {unitM}
              </p>
              <button
                type="button"
                onClick={apply}
                className="btn btn-primary"
              >
                {ru ? 'Подставить в калькулятор' : 'Apply to calculator'}
              </button>
            </div>
          )}

          <MarkerList
            markers={markers}
            now={now}
            language={language}
            onTarget={(marker) => {
              setTarget({ x: marker.x, y: marker.y })
              setPlacing('target')
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
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
              className="field w-32 py-1 font-mono text-xs"
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

          <ScreenMarkers world={map.world} author={author} language={language} />

          <p className="mt-2 text-xs text-app-muted">
            {ru
              ? `Колёсико — масштаб, перетаскивание — сдвиг. Высоты по сетке с шагом ${map.step} м: на крутых склонах ошибка до нескольких метров. Подписи сетки — сотни метров, как в 6-значной координате.`
              : `Wheel zooms, drag pans. Heights come from a ${map.step} m grid: on steep slopes the error can reach a few metres. Grid labels are hundreds of metres, as in a 6-digit grid.`}
          </p>
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
            'h-6 w-6 cursor-pointer border-2',
            value === color ? 'border-accent' : 'border-app-line-strong',
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
    <ul className="mt-3 divide-y divide-app-border border border-app-border bg-app-raised text-sm">
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
            <span className="label ml-2 text-[9.5px]">
              {marker.author}
              {marker.source === 'screen' && (ru ? ' · с экрана' : ' · from screen')}
            </span>
          </span>
          <span className="font-mono text-xs text-app-muted">
            {toGridReference(marker, 8)}
          </span>
          <span className="mono-num w-24 text-right text-[11px] text-app-muted">
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

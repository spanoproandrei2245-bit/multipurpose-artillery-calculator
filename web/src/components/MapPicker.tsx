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
import { formatSigned, readStoredText, writeStored } from '../lib/input'
import type { AngleUnit } from '../lib/journal'
import {
  deleteHeightmap,
  listHeightmaps,
  loadHeightmap,
  saveHeightmap,
  type StoredMapInfo,
} from '../lib/mapStore'
import { renderRelief } from '../lib/relief'
import type { Language } from '../types/settings'
import { Toggle } from './FormControls'

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

type Placing = 'gun' | 'target'

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

function createReliefCanvas(map: Heightmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = map.size
  canvas.height = map.size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const pixels = renderRelief(map)
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

  const relief = useMemo(() => (map ? createReliefCanvas(map) : null), [map])

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

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = '#0b1020'
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
    ctx.font = '11px ui-monospace, monospace'
    ctx.lineWidth = 1

    for (let x = Math.ceil(x0 / spacing) * spacing; (x - x0) * scale <= size.width; x += spacing) {
      if (x < 0 || x > extent) continue
      const sx = Math.round((x - x0) * scale) + 0.5
      ctx.strokeStyle = x % 1000 === 0 ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, size.height)
      ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillText(String(Math.floor(x / 100)).padStart(3, '0'), sx + 3, 12)
    }
    for (let y = Math.ceil(bottom / spacing) * spacing; y <= y0; y += spacing) {
      if (y < 0 || y > extent) continue
      const sy = Math.round((y0 - y) * scale) + 0.5
      ctx.strokeStyle = y % 1000 === 0 ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(size.width, sy)
      ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillText(String(Math.floor(y / 100)).padStart(3, '0'), 3, sy - 3)
    }

    // Линия огня
    if (gun && target) {
      const a = toScreen(gun)
      const b = toScreen(target)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])

      const label = `${Math.round(bearing(gun, target).distance)} ${unitM}`
      ctx.font = 'bold 12px system-ui, sans-serif'
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const width = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(2,6,23,0.8)'
      ctx.fillRect(mx - width / 2 - 4, my - 9, width + 8, 18)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, mx - width / 2, my + 4)
    }

    if (gun) {
      const p = toScreen(gun)
      ctx.fillStyle = '#10b981'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    if (target) {
      const p = toScreen(target)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
      ctx.moveTo(p.x - 13, p.y)
      ctx.lineTo(p.x + 13, p.y)
      ctx.moveTo(p.x, p.y - 13)
      ctx.lineTo(p.x, p.y + 13)
      ctx.stroke()
    }
  }, [canvas, map, relief, activeView, gun, target, size, unitM, ratio])

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

  const buttonClass =
    'cursor-pointer rounded-lg border border-app-border bg-app-surface px-3 py-1 text-xs text-app-text hover:border-emerald-500'

  const showLoader = adding || !map

  return (
    <div className="mt-6 rounded-lg border border-dashed border-app-border bg-app-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-app-text">
          {ru ? 'Карта с высотами' : 'Map with heights'}
          <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">
            {ru ? 'эксперимент' : 'experimental'}
          </span>
        </p>

        {maps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={ru ? 'Карта' : 'Map'}
              value={map?.world ?? ''}
              onChange={(event) => openMap(event.target.value)}
              className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
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
        <p className="mt-2 text-xs text-app-text" role="status">
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
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs text-app-text outline-none focus:border-emerald-500"
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
              className="block cursor-crosshair touch-none rounded-md"
            />
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="inline text-app-muted">{ru ? 'Орудие' : 'Gun'}: </dt>
              <dd className="inline font-mono text-app-text">
                {gun ? `${toGridReference(gun)} · ${Math.round(gunHeight ?? 0)} ${unitM}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="inline text-app-muted">{ru ? 'Цель' : 'Target'}: </dt>
              <dd className="inline font-mono text-app-text">
                {target ? `${toGridReference(target)} · ${Math.round(targetHeight ?? 0)} ${unitM}` : '—'}
              </dd>
            </div>
          </dl>

          {line && gunHeight !== null && targetHeight !== null && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-app-text">
                {Math.round(line.distance)} {unitM} · {formatAzimuth(line.azimuthMil)} · ΔH{' '}
                {formatSigned(targetHeight - gunHeight, 0)} {unitM}
              </p>
              <button
                type="button"
                onClick={apply}
                className="cursor-pointer rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
              >
                {ru ? 'Подставить в калькулятор' : 'Apply to calculator'}
              </button>
            </div>
          )}

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

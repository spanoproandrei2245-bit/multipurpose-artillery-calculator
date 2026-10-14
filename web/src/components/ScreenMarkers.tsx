import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { onHotkey } from '../lib/desktop'
import { parseGrid } from '../lib/grid'
import { readStoredText, writeStored } from '../lib/input'
import {
  addMarker,
  getMarkers,
  MARKER_RGB,
  planScreenMerge,
  removeMarker,
  type DetectedMarker,
} from '../lib/markers'
import {
  calibrate,
  findBlobs,
  pixelToMap,
  visibleArea,
  type Blob as FoundBlob,
  type Calibration,
  type CalibrationPoint,
} from '../lib/screenMarkers'
import type { Language } from '../types/settings'

interface Props {
  world: string
  author: string
  language: Language
}

interface Shot {
  image: ImageData
  // Снимок для показа
  url: string
  blobs: FoundBlob[]
}

const AUTO_INTERVAL_MS = 10_000
// Совпадение с прежней меткой: метров или пикселей снимка
const MATCH_METRES = 25
const MATCH_PIXELS = 6

function readCalibration(world: string): Calibration | null {
  try {
    const value = JSON.parse(readStoredText(`screenCalibration:${world}`)) as Calibration
    return typeof value?.scale === 'number' &&
      typeof value.originX === 'number' &&
      typeof value.originY === 'number'
      ? value
      : null
  } catch {
    return null
  }
}

function toImageData(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, width, height)
  return { image: ctx.getImageData(0, 0, width, height), url: canvas.toDataURL('image/jpeg', 0.8) }
}

async function imageFromBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const result = toImageData(bitmap, bitmap.width, bitmap.height)
  bitmap.close()
  return result
}

/**
 * Метки со скриншота карты игры: игра не затрагивается, программа
 * смотрит только на картинку. Снимок калибруется по двум
 * пересечениям сетки; пока карту в игре не двигали, калибровка
 * подходит и для следующих снимков.
 */
export function ScreenMarkers({ world, author, language }: Props) {
  const ru = language === 'ru'
  const [open, setOpen] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [calibration, setCalibration] = useState<Calibration | null>(() =>
    readCalibration(world)
  )
  // Калибровка: точки, которые уже кликнули
  const [points, setPoints] = useState<CalibrationPoint[]>([])
  const [pending, setPending] = useState<{ px: number; py: number } | null>(null)
  const [pendingGrid, setPendingGrid] = useState('')
  const [calibrating, setCalibrating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [auto, setAuto] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [live, setLive] = useState(false)

  const [prevWorld, setPrevWorld] = useState(world)
  if (prevWorld !== world) {
    setPrevWorld(world)
    setCalibration(readCalibration(world))
    setShot(null)
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  function load(result: { image: ImageData; url: string } | null) {
    if (!result) return null
    const blobs = findBlobs(result.image.data, result.image.width, result.image.height)
    const next = { ...result, blobs }
    setShot(next)
    setExcluded(new Set())
    setNotice(
      ru
        ? `Найдено меток: ${blobs.length}. Лишние можно отключить кликом.`
        : `Markers found: ${blobs.length}. Click one to skip it.`
    )
    return next
  }

  // ---- источники снимка ----
  async function startCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false,
      })
      streamRef.current = stream
      const video = document.createElement('video')
      video.muted = true
      video.srcObject = stream
      await video.play()
      videoRef.current = video
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setLive(false)
        setAuto(false)
      })
      setLive(true)
      setNotice(
        ru
          ? 'Захват идёт. Откройте карту в игре и нажмите «Снимок» (в программе для ПК — Ctrl+Alt+S).'
          : 'Capturing. Open the map in game and press "Snapshot" (desktop app: Ctrl+Alt+S).'
      )
    } catch {
      setNotice(
        ru
          ? 'Захват экрана недоступен или отменён. Вставьте скриншот (Ctrl+V) или выберите файл.'
          : 'Screen capture is unavailable or was cancelled. Paste a screenshot (Ctrl+V) or pick a file.'
      )
    }
  }

  function stopCapture() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    videoRef.current = null
    setLive(false)
    setAuto(false)
  }

  function snapshot() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    return load(toImageData(video, video.videoWidth, video.videoHeight))
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          load(await imageFromBlob(await item.getType(type)))
          return
        }
      }
      setNotice(ru ? 'В буфере нет картинки.' : 'No image in the clipboard.')
    } catch {
      setNotice(
        ru
          ? 'Браузер не дал прочитать буфер — нажмите Ctrl+V, пока эта панель открыта.'
          : 'The browser blocked the clipboard — press Ctrl+V while this panel is open.'
      )
    }
  }

  // Ctrl+V при открытой панели
  useEffect(() => {
    if (!open) return
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((f) =>
        f.type.startsWith('image/')
      )
      if (!file) return
      event.preventDefault()
      void imageFromBlob(file).then(load)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // load читает только setState и язык
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ru])

  // ---- перенос на карту ----
  function apply(current: Shot | null, skip: Set<number>) {
    if (!current || !calibration) return
    const detected: DetectedMarker[] = current.blobs
      .filter((_, index) => !skip.has(index))
      .map((blob) => ({ ...pixelToMap(calibration, blob.x, blob.y), color: blob.color }))
    const plan = planScreenMerge(
      getMarkers().filter((m) => m.world === world),
      detected,
      visibleArea(calibration, current.image.width, current.image.height),
      Math.max(MATCH_METRES, MATCH_PIXELS * calibration.scale)
    )
    plan.remove.forEach(removeMarker)
    plan.add.forEach((found) =>
      addMarker({ world, x: found.x, y: found.y, label: '', color: found.color, author, source: 'screen' })
    )
    setNotice(
      ru
        ? `На карте: новых ${plan.add.length}, убрано ${plan.remove.length}, без изменений ${detected.length - plan.add.length}.`
        : `Map: ${plan.add.length} new, ${plan.remove.length} removed, ${detected.length - plan.add.length} unchanged.`
    )
  }

  // Последние значения для таймера и глобальной клавиши
  const applyRef = useRef(() => {})
  useEffect(() => {
    applyRef.current = () => {
      const next = snapshot()
      if (next && calibration) apply(next, new Set())
    }
  })

  useEffect(() => {
    if (!auto) return
    const interval = window.setInterval(() => applyRef.current(), AUTO_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [auto])

  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'screen-markers') applyRef.current()
      }),
    []
  )

  // ---- калибровка ----
  function onImageClick(event: MouseEvent<HTMLDivElement>) {
    if (!shot) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * shot.image.width
    const py = ((event.clientY - rect.top) / rect.height) * shot.image.height

    if (calibrating) {
      setPending({ px, py })
      setPendingGrid('')
      return
    }
    // Клик по найденной метке — пропустить / вернуть
    const index = shot.blobs.findIndex(
      (blob) => Math.hypot(blob.x - px, blob.y - py) < Math.max(12, blob.width)
    )
    if (index < 0) return
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function confirmPoint() {
    const grid = parseGrid(pendingGrid)
    if (!pending || !grid) return
    // Пересечение линий сетки — угол квадрата, а не центр
    const point: CalibrationPoint = {
      ...pending,
      x: grid.x - grid.precision / 2,
      y: grid.y - grid.precision / 2,
    }
    const next = [...points, point]
    setPending(null)
    if (next.length < 2) {
      setPoints(next)
      return
    }
    const result = calibrate(next[0], next[1])
    setPoints([])
    setCalibrating(false)
    if (!result) {
      setNotice(
        ru
          ? 'Точки слишком близко или координаты совпадают — возьмите пересечения подальше друг от друга.'
          : 'The points are too close or have the same grid — pick intersections further apart.'
      )
      return
    }
    setCalibration(result)
    writeStored(`screenCalibration:${world}`, JSON.stringify(result))
    setNotice(
      ru
        ? `Калибровка готова: ${result.scale.toFixed(2)} м на пиксель.`
        : `Calibrated: ${result.scale.toFixed(2)} m per pixel.`
    )
  }

  const buttonClass =
    'cursor-pointer rounded-lg border border-app-border bg-app-surface px-3 py-1 text-xs text-app-text hover:border-emerald-500 disabled:cursor-default disabled:opacity-40'

  return (
    <details
      className="mt-4 rounded-lg border border-app-border bg-app-surface p-3"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-app-text">
        {ru ? 'Метки с экрана игры' : 'Markers from the game screen'}
        <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">
          {ru ? 'эксперимент' : 'experimental'}
        </span>
      </summary>

      <p className="mt-2 text-xs text-app-muted">
        {ru
          ? 'Программа смотрит только на картинку экрана — в игру ничего не встраивается. Ищутся цветные метки (красные, синие, зелёные, оранжевые, жёлтые, фиолетовые); чёрные не отличить от сетки.'
          : 'Only the screen image is read — nothing is injected into the game. Coloured markers are detected (red, blue, green, orange, yellow, purple); black ones look like the grid.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {live ? (
          <>
            <button type="button" className={buttonClass} onClick={() => snapshot()}>
              {ru ? 'Снимок' : 'Snapshot'}
            </button>
            <button type="button" className={buttonClass} onClick={stopCapture}>
              {ru ? 'Остановить захват' : 'Stop capture'}
            </button>
          </>
        ) : (
          <button type="button" className={buttonClass} onClick={() => void startCapture()}>
            {ru ? 'Захват экрана' : 'Capture screen'}
          </button>
        )}
        <button type="button" className={buttonClass} onClick={() => void pasteImage()}>
          {ru ? 'Вставить скриншот' : 'Paste screenshot'}
        </button>
        <label className={buttonClass}>
          {ru ? 'Файл' : 'File'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void imageFromBlob(file).then(load)
              event.target.value = ''
            }}
          />
        </label>
      </div>

      {notice && (
        <p className="mt-2 text-xs text-app-text" role="status">
          {notice}
        </p>
      )}

      {shot && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setCalibrating((value) => !value)
                setPoints([])
                setPending(null)
              }}
            >
              {calibrating
                ? ru
                  ? 'Отменить калибровку'
                  : 'Cancel calibration'
                : calibration
                  ? ru
                    ? 'Калибровать заново'
                    : 'Recalibrate'
                  : ru
                    ? 'Калибровать'
                    : 'Calibrate'}
            </button>
            <button
              type="button"
              className={`${buttonClass} border-emerald-600`}
              disabled={!calibration || calibrating}
              onClick={() => apply(shot, excluded)}
            >
              {ru ? 'Перенести на карту' : 'Put on the map'}
            </button>
            {live && (
              <label className="flex items-center gap-1 text-xs text-app-text">
                <input
                  type="checkbox"
                  checked={auto}
                  disabled={!calibration}
                  onChange={(event) => setAuto(event.target.checked)}
                  className="accent-emerald-600"
                />
                {ru ? 'Обновлять каждые 10 с' : 'Refresh every 10 s'}
              </label>
            )}
          </div>

          {calibrating && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {ru
                ? `Точка ${points.length + 1} из 2: кликните пересечение линий сетки и введите его координату (например 045 078). Точки — подальше друг от друга.`
                : `Point ${points.length + 1} of 2: click a grid line intersection and enter its grid (e.g. 045 078). Keep the points far apart.`}
            </p>
          )}
          {!calibration && !calibrating && (
            <p className="mt-2 text-xs text-app-muted">
              {ru
                ? 'Нужна калибровка: две точки сетки на снимке. Пока карту в игре не сдвигали и не меняли масштаб, она подходит и для следующих снимков.'
                : 'Calibrate first: two grid points on the snapshot. It stays valid while the in-game map is not moved or zoomed.'}
            </p>
          )}

          {pending && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-app-muted">
                {ru ? 'Координата пересечения' : 'Intersection grid'}
              </span>
              <input
                autoFocus
                value={pendingGrid}
                onChange={(event) => setPendingGrid(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirmPoint()
                }}
                placeholder="045 078"
                inputMode="numeric"
                className="w-32 rounded-lg border border-app-border bg-app-bg px-2 py-1 font-mono text-app-text outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                className={buttonClass}
                disabled={!parseGrid(pendingGrid)}
                onClick={confirmPoint}
              >
                OK
              </button>
            </div>
          )}

          <div
            onClick={onImageClick}
            className={[
              'relative mt-3 w-full overflow-hidden rounded-md border border-app-border',
              calibrating ? 'cursor-crosshair' : 'cursor-pointer',
            ].join(' ')}
          >
            <img src={shot.url} alt={ru ? 'Снимок карты' : 'Map snapshot'} className="block w-full select-none" draggable={false} />
            <svg
              viewBox={`0 0 ${shot.image.width} ${shot.image.height}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {shot.blobs.map((blob, index) => (
                <circle
                  key={index}
                  cx={blob.x}
                  cy={blob.y}
                  r={Math.max(blob.width, blob.height) * 0.9 + 4}
                  fill="none"
                  stroke={excluded.has(index) ? '#888' : MARKER_RGB[blob.color]}
                  strokeWidth={Math.max(2, shot.image.width / 500)}
                  strokeDasharray={excluded.has(index) ? '4 4' : undefined}
                />
              ))}
              {[...points, ...(pending ? [pending] : [])].map((point, index) => (
                <g key={`p${index}`} stroke="#10b981" strokeWidth={Math.max(2, shot.image.width / 600)}>
                  <line x1={point.px - 14} y1={point.py} x2={point.px + 14} y2={point.py} />
                  <line x1={point.px} y1={point.py - 14} x2={point.px} y2={point.py + 14} />
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
    </details>
  )
}

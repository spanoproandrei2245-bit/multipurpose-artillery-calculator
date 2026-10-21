import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'
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
      t('screenMarkers.markers-found-click-one-to', blobs.length)
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
        t('screenMarkers.capturing-open-the-map-in')
      )
    } catch {
      setNotice(
        t('screenMarkers.screen-capture-is-unavailable-or')
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
      setNotice(t('screenMarkers.no-image-in-the-clipboard'))
    } catch {
      setNotice(
        t('screenMarkers.the-browser-blocked-the-clipboard')
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
      t('screenMarkers.map-new-removed-unchanged', plan.add.length, plan.remove.length, detected.length - plan.add.length)
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
        t('screenMarkers.the-points-are-too-close')
      )
      return
    }
    setCalibration(result)
    writeStored(`screenCalibration:${world}`, JSON.stringify(result))
    setNotice(
      t('screenMarkers.calibrated-m-per-pixel', result.scale.toFixed(2))
    )
  }

  const buttonClass = 'btn btn-sm'

  return (
    <details
      className="disclosure panel mt-3 p-4"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="inline-flex items-center gap-2 text-app-text">
          <FieldIcon name="marker" className="h-5 w-5 text-app-muted" />
          {t('screenMarkers.markers-from-the-game-screen')}
        </span>
        <span className="tag tag-warn">
          {t('gridInput.experimental')}
        </span>
      </summary>

      <p className="mt-2 text-xs text-app-muted">
        {t('screenMarkers.only-the-screen-image-is')}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {live ? (
          <>
            <button type="button" className={buttonClass} onClick={() => snapshot()}>
              {t('screenMarkers.snapshot')}
            </button>
            <button type="button" className={buttonClass} onClick={stopCapture}>
              {t('screenMarkers.stop-capture')}
            </button>
          </>
        ) : (
          <button type="button" className={buttonClass} onClick={() => void startCapture()}>
            {t('screenMarkers.capture-screen')}
          </button>
        )}
        <button type="button" className={buttonClass} onClick={() => void pasteImage()}>
          {t('screenMarkers.paste-screenshot')}
        </button>
        <label className={buttonClass}>
          {t('screenMarkers.file')}
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
                ? t('screenMarkers.cancel-calibration')
                : calibration
                  ? t('screenMarkers.recalibrate')
                  : t('screenMarkers.calibrate')}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!calibration || calibrating}
              onClick={() => apply(shot, excluded)}
            >
              {t('screenMarkers.put-on-the-map')}
            </button>
            {live && (
              <label className="flex items-center gap-1 text-xs text-app-text">
                <input
                  type="checkbox"
                  checked={auto}
                  disabled={!calibration}
                  onChange={(event) => setAuto(event.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                {t('screenMarkers.refresh-every-10-s')}
              </label>
            )}
          </div>

          {calibrating && (
            <p className="mt-2 rounded-md bg-app-raised px-3 py-2 text-xs text-warn">
              {t('screenMarkers.point-of-2-click-a', points.length + 1)}
            </p>
          )}
          {!calibration && !calibrating && (
            <p className="mt-2 text-xs text-app-muted">
              {t('screenMarkers.calibrate-first-two-grid-points')}
            </p>
          )}

          {pending && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-app-muted">
                {t('screenMarkers.intersection-grid')}
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
                className="field w-32 py-1 text-xs"
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
              'relative mt-3 w-full overflow-hidden border border-app-border',
              calibrating ? 'cursor-crosshair' : 'cursor-pointer',
            ].join(' ')}
          >
            <img src={shot.url} alt={t('screenMarkers.map-snapshot')} className="block w-full select-none" draggable={false} />
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
                <g key={`p${index}`} stroke="var(--color-accent)" strokeWidth={Math.max(2, shot.image.width / 600)}>
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

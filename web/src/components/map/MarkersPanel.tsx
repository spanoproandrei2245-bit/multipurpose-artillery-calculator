import { useState } from 'react'

import { t } from '../../i18n'
import { parseGrid } from '../../lib/grid'
import { toGridReference, type MapPoint } from '../../lib/heightmap'
import { formatAge, markerOpacity, markerRgb, removeMarker, type MapMarker } from '../../lib/markers'
import { FieldIcon } from '../FieldIcon'
import { markerTitle } from './mapLabels'

/** Слева на карте: метки — список, «цель в метку», метка по координате. */
export function MarkersPanel({
  markers,
  now,
  onTarget,
  onAddByGrid,
}: {
  markers: MapMarker[]
  now: number
  onTarget: (marker: MapMarker) => void
  // Новая метка в точке, введённой координатой сетки
  onAddByGrid: (point: MapPoint) => void
}) {
  const [open, setOpen] = useState(false)
  const [grid, setGrid] = useState('')

  function addByGrid() {
    const point = parseGrid(grid)
    if (!point) return
    onAddByGrid({ x: point.x, y: point.y })
    setGrid('')
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-black/70 px-2.5 text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
      >
        <FieldIcon name="marker" className="h-5 w-5" />
        {t('mapPicker.markers')}
        <span className="rounded-full bg-white/20 px-1.5 text-[11.5px]">{markers.length}</span>
      </button>
      {open && (
        <div className="max-h-[min(22rem,60%)] w-64 max-w-full overflow-y-auto rounded-lg bg-black/70 p-2 text-white/90 shadow-lg backdrop-blur-sm">
          <MarkerList markers={markers} now={now} onTarget={onTarget} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-white/70">{t('mapPicker.marker-by-grid')}</span>
            <input
              value={grid}
              onChange={(event) => setGrid(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addByGrid()
              }}
              placeholder="045 078"
              inputMode="numeric"
              className="field h-8 w-24 py-0 text-[13px]"
            />
            <button type="button" onClick={addByGrid} disabled={!parseGrid(grid)} className="btn btn-sm">
              {t('mapPicker.add')}
            </button>
          </div>
        </div>
      )}
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
    return <p className="mt-3 text-xs text-app-muted">{t('mapPicker.no-markers-marker-mode-click')}</p>
  }
  return (
    <ul className="mt-3 divide-y divide-app-border overflow-hidden rounded-lg bg-app-raised text-sm">
      {markers.map((marker) => (
        <li
          key={marker.id}
          className="flex flex-wrap items-center gap-2 px-3 py-1.5"
          style={{ opacity: markerOpacity(now - marker.createdAt) }}
        >
          <span className="h-3 w-3 shrink-0 rotate-45" style={{ backgroundColor: markerRgb(marker.color) }} />
          <span className="min-w-0 flex-1 truncate text-app-text">
            {markerTitle(marker)}
            <span className="label ml-2 text-[12.5px]">
              {marker.author}
              {marker.source === 'screen' && t('mapPicker.from-screen')}
            </span>
          </span>
          <span className="text-xs text-app-muted">{toGridReference(marker, 8)}</span>
          <span className="mono-num w-24 text-right text-[12.5px] text-app-muted">
            {formatAge(now - marker.createdAt)}
          </span>
          <button type="button" onClick={() => onTarget(marker)} className="btn btn-sm">
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

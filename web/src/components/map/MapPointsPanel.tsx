import { useRef, useState } from 'react'

import { t } from '../../i18n'
import { parseGrid } from '../../lib/grid'
import { toGridReference, type MapPoint } from '../../lib/heightmap'
import type { JournalActions } from '../../lib/journalIO'
import { formatAge, markerOpacity, markerRgb, removeMarker, type MapMarker } from '../../lib/markers'
import { FieldIcon } from '../FieldIcon'
import type { QuickTarget } from '../MapPicker'
import { markerTitle } from './mapLabels'

/**
 * Слева на карте: один список «Метки». В нём сохранённые цели (перекрестие:
 * нажать — загрузить расчёт) и метки (ромб цвета метки: нажать — цель в эту
 * точку). Метки при включённой связке видны всем в комнате.
 */
export function MapPointsPanel({
  targets,
  actions,
  onPickTarget,
  markers,
  now,
  onTargetMarker,
  onAddByGrid,
  onNotice,
  shared,
}: {
  targets: readonly QuickTarget[]
  // Журнал целей: экспорт, импорт, переименование; без него целей в списке нет
  actions?: JournalActions
  onPickTarget?: (id: string) => void
  // Метки (если включены в настройках)
  markers: MapMarker[] | null
  now: number
  onTargetMarker: (marker: MapMarker) => void
  onAddByGrid: (point: MapPoint) => void
  onNotice: (text: string) => void
  // Связка включена: метки расходятся по ней
  shared: boolean
}) {
  const importRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [grid, setGrid] = useState('')
  // На узком экране список свёрнут
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)

  const count = (actions ? targets.length : 0) + (markers?.length ?? 0)

  function addByGrid() {
    const point = parseGrid(grid)
    if (!point) return
    onAddByGrid({ x: point.x, y: point.y })
    setGrid('')
  }

  const iconButton =
    'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-black/70 px-2.5 text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
        >
          <FieldIcon name="marker" className="h-5 w-5" />
          {t('mapPicker.markers')}
          <span className="rounded-full bg-white/20 px-1.5 text-[11.5px]">{count}</span>
        </button>
        {actions && (
          <>
            <button
              type="button"
              disabled={targets.length === 0}
              title={t('mapPicker.export-targets-to-a-file')}
              aria-label={t('mapPicker.export-targets')}
              onClick={actions.exportAll}
              className={iconButton}
            >
              <FieldIcon name="export" className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              title={t('mapPicker.import-targets-from-a-file')}
              aria-label={t('mapPicker.import-targets')}
              onClick={() => importRef.current?.click()}
              className={iconButton}
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
                if (file) void actions.importFile(file).then(onNotice)
                event.target.value = ''
              }}
            />
          </>
        )}
      </div>

      {open && (
        <div className="max-h-[min(24rem,65%)] w-64 max-w-full overflow-y-auto rounded-lg bg-black/75 p-1 text-white/90 shadow-lg backdrop-blur-sm">
          {count === 0 && (
            <p className="px-2 py-1.5 text-[12.5px] text-white/60">{t('mapPicker.points-empty')}</p>
          )}
          <ul>
            {actions &&
              targets.map((qt) => (
                <li key={`t:${qt.id}`} className="group relative">
                  {renamingId === qt.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      maxLength={60}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={() => {
                        actions.rename(qt.id, renameValue)
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
                        onClick={() => onPickTarget?.(qt.id)}
                        className={[
                          'flex w-full cursor-pointer items-start gap-2 rounded-md py-1 pr-14 pl-2 text-left transition-colors',
                          qt.active ? 'bg-accent-solid text-white' : 'hover:bg-white/15',
                        ].join(' ')}
                      >
                        <FieldIcon name="target" className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        <span className="min-w-0">
                          <span className="block text-[13px] leading-snug font-medium break-words">{qt.name}</span>
                          <span className="block text-[11.5px] leading-snug break-words tabular-nums opacity-70">
                            {qt.detail}
                          </span>
                        </span>
                      </button>
                      <span className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
                          onClick={() => actions.remove(qt.id)}
                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/80 hover:bg-white/20"
                        >
                          <FieldIcon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            {markers?.map((marker) => (
              <li
                key={`m:${marker.id}`}
                className="group relative"
                style={{ opacity: markerOpacity(now - marker.createdAt) }}
              >
                <button
                  type="button"
                  title={t('artilleryCalculator.target')}
                  onClick={() => onTargetMarker(marker)}
                  className="flex w-full cursor-pointer items-start gap-2 rounded-md py-1 pr-8 pl-2 text-left transition-colors hover:bg-white/15"
                >
                  <span
                    className="mt-1 ml-0.5 h-2.5 w-2.5 shrink-0 rotate-45"
                    style={{ backgroundColor: markerRgb(marker.color) }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-snug font-medium break-words">{markerTitle(marker)}</span>
                    <span className="block text-[11.5px] leading-snug break-words tabular-nums opacity-70">
                      {toGridReference(marker, 8)} · {formatAge(now - marker.createdAt)}
                      {marker.author ? ` · ${marker.author}` : ''}
                      {marker.source === 'screen' && t('mapPicker.from-screen')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeMarker(marker.id)}
                  aria-label={t('mapPicker.delete-marker')}
                  title={t('mapPicker.delete-marker')}
                  className="absolute top-1 right-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/70 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-white/20 hover:text-white"
                >
                  <FieldIcon name="trash" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {markers && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-white/10 px-1.5 pt-2 pb-1">
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
              {shared && (
                <p className="w-full text-[11.5px] text-white/60">{t('mapPicker.markers-shared')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

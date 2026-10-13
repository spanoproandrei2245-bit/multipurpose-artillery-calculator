import { useState } from 'react'

import { artilleryRegistry } from '../data/artillery/registry'
import { isModelId, models } from '../data/models'
import {
  formatDayKey,
  formatTime,
  groupByDay,
  type JournalEntry,
} from '../lib/journal'

import type { Language } from '../types/settings'

interface Props {
  entries: readonly JournalEntry[]
  // Цель, открытая в калькуляторе
  activeId?: string | null
  language: Language
  onLoad: (entry: JournalEntry) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onClearDay: (dayKey: string) => void
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

export function ShotJournal({
  entries,
  activeId = null,
  language,
  onLoad,
  onRename,
  onRemove,
  onClearDay,
}: Props) {
  const ru = language === 'ru'
  const days = groupByDay(entries)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(entry: JournalEntry) {
    setEditingId(entry.id)
    setEditValue(entry.name)
  }

  function commitEdit() {
    if (editingId !== null) onRename(editingId, editValue)
    setEditingId(null)
  }

  function describe(entry: JournalEntry): string {
    const modelName = isModelId(entry.modelId)
      ? models[entry.modelId].name
      : entry.modelId

    const ammo = isModelId(entry.modelId)
      ? artilleryRegistry[entry.modelId].ammunition?.find(
          (a) => a.id === entry.ammoId
        )
      : undefined

    const heights =
      entry.ownHeight !== null && entry.targetHeight !== null
        ? ` · ΔH ${formatSigned(entry.targetHeight - entry.ownHeight)} ${ru ? 'м' : 'm'}`
        : ''

    const correction =
      entry.rangeCorrection !== 0
        ? ` · ${ru ? 'попр.' : 'corr.'} ${formatSigned(entry.rangeCorrection)} ${ru ? 'м' : 'm'}`
        : ''

    const lateral =
      entry.lateralCorrection !== undefined && entry.lateralCorrection !== 0
        ? ` · ${entry.lateralCorrection > 0 ? (ru ? 'вправо' : 'right') : ru ? 'влево' : 'left'} ${Math.abs(entry.lateralCorrection)} ${ru ? 'м' : 'm'}`
        : ''

    const weather = entry.weather
      ? ` · ${ru ? 'с погодой' : 'with weather'}`
      : ''

    return [
      modelName,
      ammo ? `${ammo.designation} [${ammo.type}]` : null,
      `${ru ? 'заряд' : 'charge'} ${entry.charge}`,
    ]
      .filter(Boolean)
      .join(' · ')
      .concat(
        ` · ${entry.distance} ${ru ? 'м' : 'm'}`,
        heights,
        correction,
        lateral,
        weather
      )
  }

  const buttonClass =
    'cursor-pointer rounded-md border border-app-border bg-app-bg px-3 py-1 text-xs text-app-text hover:border-emerald-500'

  return (
    <section className="mt-6 rounded-xl border border-app-border bg-app-surface p-6">
      <h2 className="text-xl font-bold text-app-text">
        {ru ? 'Журнал' : 'Journal'}
      </h2>

      {days.length === 0 && (
        <p className="mt-3 text-sm text-app-muted">
          {ru
            ? 'Пока пусто. Рассчитайте установки и нажмите «Сохранить в журнал».'
            : 'Empty for now. Calculate a solution and press "Save to journal".'}
        </p>
      )}

      <div className="mt-4 space-y-6">
        {days.map((day) => (
          <div key={day.dayKey}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm text-app-muted">
                {ru ? 'от' : 'from'} {formatDayKey(day.dayKey)}
              </h3>

              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  const message = ru
                    ? `Удалить все записи за ${formatDayKey(day.dayKey)}?`
                    : `Delete all entries from ${formatDayKey(day.dayKey)}?`
                  if (window.confirm(message)) onClearDay(day.dayKey)
                }}
              >
                {ru ? 'Удалить день' : 'Delete day'}
              </button>
            </div>

            <ul className="mt-2 space-y-2">
              {day.entries.map((entry) => (
                <li
                  key={entry.id}
                  className={[
                    'rounded-lg border bg-app-bg p-3',
                    entry.id === activeId
                      ? 'border-emerald-500'
                      : 'border-app-border',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {editingId === entry.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editValue}
                        maxLength={60}
                        onChange={(event) =>
                          setEditValue(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitEdit()
                          if (event.key === 'Escape') setEditingId(null)
                        }}
                        aria-label={ru ? 'Название метки' : 'Mark name'}
                        className="min-w-0 flex-1 rounded-md border border-app-border bg-app-surface px-2 py-1 text-base text-app-text outline-none focus:border-emerald-500"
                      />
                    ) : (
                      <p className="min-w-0 break-words text-lg font-semibold text-app-text">
                        {entry.name}
                      </p>
                    )}

                    <span className="text-xs text-app-muted">
                      {formatTime(entry.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-app-muted">
                    {describe(entry)}
                  </p>

                  <p className="mt-1 text-sm text-app-text">
                    {Math.round(entry.elevation)} {ru ? 'мил' : 'mil'} ·{' '}
                    {entry.tof.toFixed(1)} {ru ? 'с' : 's'}
                    {entry.firingAzimuth !== undefined &&
                      entry.firingAzimuth !== null && (
                        <>
                          {' · '}
                          {ru ? 'азимут' : 'azimuth'}{' '}
                          {entry.azimuthUnit === 'deg'
                            ? `${entry.firingAzimuth.toFixed(1)}°`
                            : `${entry.firingAzimuth.toFixed(0)} ${ru ? 'мил' : 'mil'}`}
                        </>
                      )}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {editingId === entry.id ? (
                      <>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={commitEdit}
                        >
                          {ru ? 'Готово' : 'Done'}
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => setEditingId(null)}
                        >
                          {ru ? 'Отмена' : 'Cancel'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={!isModelId(entry.modelId)}
                          onClick={() => onLoad(entry)}
                        >
                          {ru ? 'Загрузить' : 'Load'}
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => startEdit(entry)}
                        >
                          {ru ? 'Переименовать' : 'Rename'}
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => onRemove(entry.id)}
                        >
                          {ru ? 'Удалить' : 'Delete'}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

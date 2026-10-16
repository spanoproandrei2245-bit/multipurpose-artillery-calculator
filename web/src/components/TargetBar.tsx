import { isModelId, models } from '../data/models'
import { recentEntries, type JournalEntry } from '../lib/journal'
import type { Language } from '../types/settings'

interface Props {
  entries: readonly JournalEntry[]
  activeId: string | null
  onLoad: (entry: JournalEntry) => void
  language: Language
}

/** Короткое имя модели: «M252 (81 mm)» → «M252». */
function shortModel(modelId: string): string {
  return isModelId(modelId) ? models[modelId].name.split(' ')[0] : modelId
}

/**
 * Быстрое переключение между последними сохранёнными целями
 * прямо над калькулятором.
 */
export function TargetBar({ entries, activeId, onLoad, language }: Props) {
  const ru = language === 'ru'

  if (entries.length === 0) return null

  const recent = recentEntries(entries)

  return (
    <div className="mt-4">
      <p className="label mb-2 flex items-center gap-2">
        {ru ? 'Сохранённые цели' : 'Saved targets'}
        <span className="kbd">N</span>
        <span className="kbd">P</span>
      </p>

      <div
        role="list"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {recent.map((entry) => {
          const active = entry.id === activeId

          return (
            <button
              key={entry.id}
              type="button"
              role="listitem"
              aria-current={active ? 'true' : undefined}
              disabled={!isModelId(entry.modelId)}
              onClick={() => onLoad(entry)}
              className={[
                'shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-left transition-colors',
                active
                  ? 'bg-accent-soft ring-1 ring-accent'
                  : 'bg-app-raised hover:bg-app-raised-hover',
              ].join(' ')}
            >
              <span className="block max-w-40 truncate text-sm font-medium text-app-text">
                {entry.name}
              </span>
              <span className="block text-[12.5px] text-app-muted tabular-nums">
                {shortModel(entry.modelId)}
                {entry.mode === 'LOW' && ' LOW'} · {entry.distance}{' '}
                {ru ? 'м' : 'm'} · {Math.round(entry.elevation)}{' '}
                {ru ? 'мил' : 'mil'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

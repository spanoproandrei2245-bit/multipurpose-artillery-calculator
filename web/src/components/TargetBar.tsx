import { isModelId, models } from '../data/models'
import type { JournalEntry } from '../lib/journal'
import type { Language } from '../types/settings'

interface Props {
  entries: readonly JournalEntry[]
  activeId: string | null
  onLoad: (entry: JournalEntry) => void
  language: Language
}

// Сколько последних целей показывать в полоске
const LIMIT = 10

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

  const recent = [...entries]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, LIMIT)

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium text-app-muted">
        {ru ? 'Цели' : 'Targets'}
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
                'shrink-0 cursor-pointer rounded-lg border px-3 py-2 text-left',
                active
                  ? 'border-emerald-500 bg-app-bg'
                  : 'border-app-border bg-app-bg hover:border-emerald-500/60',
              ].join(' ')}
            >
              <span className="block max-w-40 truncate text-sm font-semibold text-app-text">
                {entry.name}
              </span>
              <span className="block text-xs text-app-muted">
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

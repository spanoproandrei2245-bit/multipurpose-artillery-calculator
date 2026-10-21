import { t } from '../i18n'
import { useRef, useState } from 'react'

import { isModelId, models } from '../data/models'
import { recentEntries, type JournalEntry } from '../lib/journal'
import type { JournalActions } from '../lib/journalIO'
import { FieldIcon } from './FieldIcon'

interface Props {
  entries: readonly JournalEntry[]
  activeId: string | null
  onLoad: (entry: JournalEntry) => void
  // Экспорт и импорт целей (когда карты нет, это единственное место)
  actions?: JournalActions
}

/** Короткое имя модели: «M252 (81 mm)» → «M252». */
function shortModel(modelId: string): string {
  return isModelId(modelId) ? models[modelId].name.split(' ')[0] : modelId
}

/**
 * Быстрое переключение между последними сохранёнными целями
 * прямо над калькулятором.
 */
export function TargetBar({ entries, activeId, onLoad, actions }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (entries.length === 0 && !actions) return null

  const recent = recentEntries(entries)

  return (
    <div className="mt-4">
      <p className="label mb-2 flex items-center gap-2">
        {t('targetBar.saved-targets')}
        <span className="kbd">N</span>
        <span className="kbd">P</span>
        {actions && (
          <span className="ml-auto flex gap-1">
            <button
              type="button"
              className="btn btn-sm px-2"
              disabled={entries.length === 0}
              aria-label={t('mapPicker.export-targets')}
              title={t('mapPicker.export-targets-to-a-file')}
              onClick={actions.exportAll}
            >
              <FieldIcon name="export" className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-sm px-2"
              aria-label={t('mapPicker.import-targets')}
              title={t('mapPicker.import-targets-from-a-file')}
              onClick={() => fileRef.current?.click()}
            >
              <FieldIcon name="import" className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void actions.importFile(file).then(setNotice)
                event.target.value = ''
              }}
            />
          </span>
        )}
      </p>
      {notice && <p className="mb-2 text-[13px] text-app-muted">{notice}</p>}

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
                {t('unit.m')} · {Math.round(entry.elevation)}{' '}
                {t('unit.mil')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

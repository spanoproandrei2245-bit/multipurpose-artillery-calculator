import { useRef, useState } from 'react'

import { t } from '../../i18n'
import type { JournalActions } from '../../lib/journalIO'
import { FieldIcon } from '../FieldIcon'
import type { QuickTarget } from '../MapPicker'

/** Слева на карте: сохранённые цели — выбор, переименование, экспорт и импорт. */
export function TargetsPanel({
  targets,
  actions,
  onPick,
  onNotice,
}: {
  targets: readonly QuickTarget[]
  actions: JournalActions
  onPick?: (id: string) => void
  onNotice: (text: string) => void
}) {
  const importRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // На узком экране список свёрнут
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-black/70 px-2.5 text-[13px] font-medium text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
        >
          <FieldIcon name="list" className="h-5 w-5" />
          {t('mapPicker.targets')}
          <span className="rounded-full bg-white/20 px-1.5 text-[11.5px]">{targets.length}</span>
        </button>
        <button
          type="button"
          disabled={targets.length === 0}
          title={t('mapPicker.export-targets-to-a-file')}
          aria-label={t('mapPicker.export-targets')}
          onClick={actions.exportAll}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FieldIcon name="export" className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          title={t('mapPicker.import-targets-from-a-file')}
          aria-label={t('mapPicker.import-targets')}
          onClick={() => importRef.current?.click()}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white/90 shadow-lg backdrop-blur-sm hover:bg-black/80"
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
      </div>
      {open && (
        <ul className="max-h-[min(22rem,60%)] w-56 max-w-full overflow-y-auto rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm">
          {targets.length === 0 && (
            <li className="px-2 py-1.5 text-[12.5px] text-white/60">{t('mapPicker.empty-so-far-work-out')}</li>
          )}
          {targets.map((qt) => (
            <li key={qt.id} className="group relative">
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
                    onClick={() => onPick?.(qt.id)}
                    className={[
                      'flex w-full cursor-pointer flex-col rounded-md py-1 pr-14 pl-2 text-left transition-colors',
                      qt.active ? 'bg-accent-solid text-white' : 'text-white/90 hover:bg-white/15',
                    ].join(' ')}
                  >
                    <span className="truncate text-[13px] font-medium">{qt.name}</span>
                    <span className="truncate text-[11.5px] tabular-nums opacity-70">{qt.detail}</span>
                  </button>
                  <span className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
        </ul>
      )}
    </div>
  )
}

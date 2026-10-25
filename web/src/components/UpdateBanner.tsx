import { useEffect, useState } from 'react'

import { t } from '../i18n'
import { checkForUpdate, type AvailableUpdate } from '../lib/updater'
import { FieldIcon } from './FieldIcon'

type Phase = { kind: 'idle' } | { kind: 'installing'; share: number | null } | { kind: 'failed' }

/** Программа для ПК: плашка «доступна новая версия» с установкой в один клик. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null)
  const [hidden, setHidden] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    // Не мешаем запуску: проверка через несколько секунд
    const timer = window.setTimeout(() => {
      void checkForUpdate().then((found) => {
        if (!cancelled) setUpdate(found)
      })
    }, 4000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  if (!update || hidden) return null

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-40 flex max-w-sm flex-col gap-2 rounded-xl bg-app-raised p-4 shadow-xl shadow-black/40 ring-1 ring-app-line-strong"
    >
      <p className="flex items-center gap-2 font-semibold text-app-text">
        <FieldIcon name="desktop" className="h-5 w-5 text-accent" />
        {t('update.available', update.version)}
      </p>
      {phase.kind === 'installing' && (
        <p className="text-[13px] text-app-muted">
          {phase.share === null
            ? t('update.downloading')
            : `${t('update.downloading')} ${Math.round(phase.share * 100)}%`}
        </p>
      )}
      {phase.kind === 'failed' && <p className="text-[13px] text-danger">{t('update.failed')}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={phase.kind === 'installing'}
          onClick={() => {
            setPhase({ kind: 'installing', share: null })
            update
              .install((share) => setPhase({ kind: 'installing', share }))
              .catch(() => setPhase({ kind: 'failed' }))
          }}
        >
          {t('update.install')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={phase.kind === 'installing'}
          onClick={() => setHidden(true)}
        >
          {t('update.later')}
        </button>
      </div>
    </div>
  )
}

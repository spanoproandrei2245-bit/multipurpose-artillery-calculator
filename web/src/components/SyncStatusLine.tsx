import { t } from '../i18n'
import { syncStatusColor, syncStatusText, useSync } from '../lib/syncContext'

/** Короткая строка о связке под таймером калькулятора. */
export function SyncStatusLine() {
  const sync = useSync()
  if (!sync.enabled) return null

  const gunners = sync.peers.filter((peer) => peer.role === 'gunner').length

  return (
    <p className="label mt-2 flex items-center gap-2">
      <span
        className={`inline-block h-1.5 w-1.5 shrink-0 ${syncStatusColor(sync.status)}`}
      />
      <span>
        {t('footer.link')} {sync.code} · {syncStatusText(sync.status)}
        {sync.status === 'online' &&
          (sync.role === 'computer'
            ? ` · ${t('syncStatusLine.gunners')}: ${gunners}`
            : ` · ${t('syncStatusLine.you-are-a-gunner-see')}`)}
      </span>
    </p>
  )
}

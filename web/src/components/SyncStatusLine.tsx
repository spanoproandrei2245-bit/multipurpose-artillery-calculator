import { syncStatusColor, syncStatusText, useSync } from '../lib/syncContext'
import type { Language } from '../types/settings'

/** Короткая строка о связке под таймером калькулятора. */
export function SyncStatusLine({ language }: { language: Language }) {
  const ru = language === 'ru'
  const sync = useSync()
  if (!sync.enabled) return null

  const gunners = sync.peers.filter((peer) => peer.role === 'gunner').length

  return (
    <p className="label mt-2 flex items-center gap-2">
      <span
        className={`inline-block h-1.5 w-1.5 shrink-0 ${syncStatusColor(sync.status)}`}
      />
      <span>
        {ru ? 'Связка' : 'Link'} {sync.code} · {syncStatusText(sync.status, ru)}
        {sync.status === 'online' &&
          (sync.role === 'computer'
            ? ` · ${ru ? 'стрелков' : 'gunners'}: ${gunners}`
            : ` · ${ru ? 'вы стрелок, установки — во вкладке «Связка»' : 'you are a gunner, see the Link tab'}`)}
      </span>
    </p>
  )
}

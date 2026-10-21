import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { t } from '../i18n'
import { deviceId } from '../lib/markers'
import {
  openRequests,
  type RequestKind,
  parseWorkshopLink,
  type MapRequest,
  type RequestsSession,
  type RequestsStatus,
} from '../lib/mapRequests'
import { SYNC_SERVERS } from '../lib/sync'
import { FieldIcon } from './FieldIcon'

/**
 * «Предложить карту»: вставьте ссылку на мод карты и проголосуйте;
 * ниже — все запрошенные карты с голосами, за которые может проголосовать
 * любой. Данные живут на публичных MQTT-брокерах (lib/mapRequests).
 */
export function MapRequests({
  onClose,
  kind = 'map',
}: {
  onClose: () => void
  // Что предлагают: карту (по умолчанию) или орудие
  kind?: RequestKind
}) {
  const weapon = kind === 'weapon'
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [requests, setRequests] = useState<MapRequest[]>([])
  const [status, setStatus] = useState<RequestsStatus>('connecting')
  const session = useRef<RequestsSession | null>(null)

  useEffect(() => {
    let cancelled = false
    let opened: RequestsSession | null = null
    openRequests(
      SYNC_SERVERS.map((server) => server.url),
      deviceId,
      (list) => !cancelled && setRequests(list),
      (next) => !cancelled && setStatus(next),
      kind
    )
      .then((s) => {
        if (cancelled) s.close()
        else {
          opened = s
          session.current = s
        }
      })
      .catch(() => !cancelled && setStatus('offline'))
    return () => {
      cancelled = true
      opened?.close()
      session.current = null
    }
  }, [kind])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parsed = parseWorkshopLink(link)
  const existing = parsed
    ? requests.find((r) => r.workshopId === parsed.id)
    : undefined
  const ready = status === 'ready'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={weapon ? t('requests.weapon-title') : t('requests.title')}
      className="tour-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-app-text">
            {weapon ? t('requests.weapon-title') : t('requests.title')}
          </h2>
          <button
            type="button"
            className="btn btn-ghost px-2"
            aria-label={t('requests.close')}
            onClick={onClose}
          >
            <FieldIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-[13.5px] text-app-muted">
          {weapon ? t('requests.weapon-intro') : t('requests.intro')}
        </p>

        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=…"
          aria-invalid={link.trim() !== '' && !parsed}
          className="field mt-3"
        />
        <input
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder={weapon ? t('requests.weapon-name-placeholder') : t('requests.name-placeholder')}
          className="field mt-2"
        />

        {link.trim() !== '' && !parsed && (
          <p className="mt-2 text-[13px] text-danger">{t('requests.not-a-link')}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {existing ? (
            <>
              <span className="text-[13.5px] text-app-text-2">
                {weapon ? t('requests.weapon-already', existing.votes) : t('requests.already', existing.votes)}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={existing.mine || !ready}
                onClick={() => session.current?.vote(existing.workshopId, true)}
              >
                {existing.mine ? t('requests.voted') : t('requests.vote')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!parsed || !ready}
              onClick={() => {
                if (!parsed) return
                session.current?.suggest(parsed, name)
                setLink('')
                setName('')
              }}
            >
              {t('requests.suggest')}
            </button>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-app-muted">
            <span
              className={[
                'h-2 w-2 rounded-full',
                status === 'ready' ? 'bg-ok' : status === 'offline' ? 'bg-danger' : 'bg-warn',
              ].join(' ')}
            />
            {status === 'ready'
              ? t('requests.status-ready')
              : status === 'offline'
                ? t('requests.status-offline')
                : t('requests.status-connecting')}
          </span>
        </div>

        <h3 className="mt-5 font-semibold text-app-text">
          {weapon ? t('requests.weapon-list-title') : t('requests.list-title')}
        </h3>
        {requests.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-app-muted">
            {status === 'ready' ? t('requests.empty') : t('requests.loading')}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {requests.map((request) => (
              <li
                key={request.workshopId}
                className="flex items-center gap-3 rounded-md bg-app-raised px-3 py-2"
              >
                <button
                  type="button"
                  aria-pressed={request.mine}
                  aria-label={request.mine ? t('requests.unvote') : t('requests.vote')}
                  title={request.mine ? t('requests.unvote') : t('requests.vote')}
                  disabled={!ready}
                  onClick={() => session.current?.vote(request.workshopId, !request.mine)}
                  className={[
                    'flex w-11 shrink-0 cursor-pointer flex-col items-center rounded-md py-1 leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    request.mine
                      ? 'bg-accent-solid text-white'
                      : 'bg-app-raised-hover text-app-text hover:bg-app-line-strong',
                  ].join(' ')}
                >
                  <FieldIcon name="arrowUp" className="h-3.5 w-3.5" />
                  <b className="tabular-nums">{request.votes}</b>
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-app-text">{request.name}</span>
                  <a
                    href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${request.workshopId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[12px] text-app-muted hover:underline"
                  >
                    Workshop {request.workshopId}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-app-faint">{t('requests.note')}</p>
      </div>
    </div>
    ,
    document.body
  )
}

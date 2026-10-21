import { useEffect, useState } from 'react'

import {
  buildIssueUrl,
  fetchRequests,
  parseWorkshopLink,
  type MapRequest,
} from '../lib/mapRequests'
import type { Language } from '../types/settings'
import { FieldIcon } from './FieldIcon'

/**
 * «Предложить карту»: ссылка на мод карты → заявка на GitHub. Ниже —
 * список запрошенных карт с числом голосов, чтобы за них мог проголосовать
 * любой.
 */
export function MapRequests({
  language,
  onClose,
}: {
  language: Language
  onClose: () => void
}) {
  const ru = language === 'ru'
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [requests, setRequests] = useState<MapRequest[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchRequests()
      .then((items) => !cancelled && setRequests(items))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parsed = parseWorkshopLink(link)
  const existing = parsed
    ? requests?.find((r) => r.workshopId === parsed.id)
    : undefined

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ru ? 'Предложить карту' : 'Suggest a map'}
      className="tour-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-app-text">
            {ru ? 'Предложить карту' : 'Suggest a map'}
          </h2>
          <button
            type="button"
            className="btn btn-ghost px-2"
            aria-label={ru ? 'Закрыть' : 'Close'}
            onClick={onClose}
          >
            <FieldIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-[13.5px] text-app-muted">
          {ru
            ? 'Вставьте ссылку на мод карты в Steam Workshop. Чем больше голосов у карты, тем раньше она появится.'
            : 'Paste the Steam Workshop link of the map mod. The more votes a map has, the sooner it is added.'}
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
          placeholder={ru ? 'Название карты (необязательно)' : 'Map name (optional)'}
          className="field mt-2"
        />

        {link.trim() !== '' && !parsed && (
          <p className="mt-2 text-[13px] text-danger">
            {ru
              ? 'Это не ссылка на мод в Steam Workshop.'
              : 'That is not a Steam Workshop link.'}
          </p>
        )}

        {existing ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-app-raised px-3 py-2 text-[13.5px]">
            <span className="text-app-text-2">
              {ru
                ? `Эта карта уже запрошена (${existing.votes}). Проголосуйте за неё:`
                : `This map is already requested (${existing.votes}). Vote for it:`}
            </span>
            <a
              href={existing.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm btn-primary"
            >
              {ru ? 'Голосовать' : 'Vote'}
            </a>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={parsed ? buildIssueUrl(parsed, name) : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!parsed}
              onClick={(event) => !parsed && event.preventDefault()}
              className={`btn btn-primary ${parsed ? '' : 'pointer-events-none opacity-40'}`}
            >
              {ru ? 'Предложить на GitHub' : 'Suggest on GitHub'}
            </a>
            <span className="text-[12.5px] text-app-muted">
              {ru
                ? 'Откроется готовая заявка, нужна учётная запись GitHub.'
                : 'A ready-made request opens; a GitHub account is required.'}
            </span>
          </div>
        )}

        <h3 className="mt-5 font-semibold text-app-text">
          {ru ? 'Запрошенные карты' : 'Requested maps'}
        </h3>
        {failed ? (
          <p className="mt-2 text-[13.5px] text-app-muted">
            {ru
              ? 'Не удалось загрузить список (нет сети или превышен лимит GitHub). Попробуйте позже.'
              : 'Could not load the list (offline or GitHub rate limit). Try again later.'}
          </p>
        ) : requests === null ? (
          <p className="mt-2 text-[13.5px] text-app-muted">
            {ru ? 'Загрузка…' : 'Loading…'}
          </p>
        ) : requests.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-app-muted">
            {ru ? 'Пока никто ничего не предложил.' : 'Nothing has been suggested yet.'}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-md bg-app-raised px-3 py-2"
              >
                <span className="flex w-10 shrink-0 flex-col items-center leading-tight">
                  <FieldIcon name="arrowUp" className="h-3.5 w-3.5 text-accent" />
                  <b className="tabular-nums text-app-text">{request.votes}</b>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-app-text">{request.name}</span>
                  {request.workshopId && (
                    <a
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${request.workshopId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[12px] text-app-muted hover:underline"
                    >
                      Workshop {request.workshopId}
                    </a>
                  )}
                </span>
                <a
                  href={request.issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                >
                  {ru ? 'Голосовать' : 'Vote'}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-app-faint">
          {ru
            ? 'Голос — это 👍 на странице заявки в GitHub.'
            : 'A vote is a 👍 on the request page on GitHub.'}
        </p>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

import { CombatScreen } from '../components/CombatScreen'
import { FireTimer, type FireTimerHandle } from '../components/FireTimer'
import { Toggle } from '../components/FormControls'
import {
  isDesktop,
  notifyOverlayShot,
  onHotkey,
  onSolutionRequest,
  publishSolution,
  type OverlayState,
} from '../lib/desktop'
import { beep } from '../lib/sound'
import {
  generateRoomCode,
  inviteLink,
  isValidRoomCode,
  PUBLIC_SITE_URL,
  SYNC_SERVERS,
  type SyncRole,
  type SyncServerId,
} from '../lib/sync'
import { syncStatusColor, syncStatusText, useSync } from '../lib/syncContext'
import { useHotkeys } from '../lib/useHotkeys'
import { useWakeLock } from '../lib/useWakeLock'
import type { Language } from '../types/settings'

interface Props {
  language: Language
}

/** Сколько секунд назад — для «обновлено N с назад». */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs])
  return now
}

function ago(ms: number, ru: boolean): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return ru ? `${seconds} с назад` : `${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  return ru ? `${minutes} мин назад` : `${minutes} min ago`
}

/**
 * Связка наводчик ↔ стрелок: наводчик считает в калькуляторе,
 * у стрелков установки обновляются сами; «Выстрел» на любом
 * устройстве запускает отсчёт до разрыва у всех.
 */
export function SyncPage({ language }: Props) {
  const ru = language === 'ru'
  const sync = useSync()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-app-text">
          {ru ? 'Связка наводчик ↔ стрелок' : 'Fire direction ↔ gunner link'}
        </h2>
        <p className="mt-1 text-sm text-app-muted">
          {ru
            ? 'Наводчик считает в калькуляторе — у стрелков установки обновляются сами. «Выстрел» на любом устройстве запускает отсчёт до разрыва у всех. Нужен интернет на обоих устройствах.'
            : 'The fire direction computer works in the calculator; gunners see the settings update live. "Fire" on any device starts the impact countdown everywhere. Both devices need internet.'}
        </p>
      </div>

      <RoomCard language={language} />

      {sync.enabled &&
        (sync.role === 'gunner' ? (
          <GunnerView language={language} />
        ) : (
          <ComputerView language={language} />
        ))}
    </div>
  )
}

function RoomCard({ language }: Props) {
  const ru = language === 'ru'
  const sync = useSync()
  const validCode = isValidRoomCode(sync.code)

  // Из программы для ПК и с localhost телефон по текущему адресу
  // не откроет — приглашение ведёт на опубликованный сайт.
  const local =
    isDesktop ||
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const link = validCode
    ? inviteLink(local ? PUBLIC_SITE_URL : window.location.href, sync.code, sync.server)
    : null

  const [qr, setQr] = useState<{ link: string; image: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!link) return
    let cancelled = false
    QRCode.toDataURL(link, { margin: 1, width: 192 })
      .then((image) => {
        if (!cancelled) setQr({ link, image })
      })
      .catch(() => {
        // Без картинки остаётся ссылка текстом.
      })
    return () => {
      cancelled = true
    }
  }, [link])

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Буфер обмена недоступен — ссылку видно на экране.
    }
  }

  const roles: { value: SyncRole; label: string }[] = [
    { value: 'computer', label: ru ? 'Наводчик (считаю)' : 'FDC (I compute)' },
    { value: 'gunner', label: ru ? 'Стрелок (получаю)' : 'Gunner (I receive)' },
  ]

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="mb-1 text-sm text-app-muted">
            {ru ? 'Я на этом устройстве' : 'On this device I am'}
          </p>
          <Toggle
            value={sync.role}
            options={roles}
            onChange={sync.setRole}
            label={ru ? 'Роль' : 'Role'}
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-app-muted">
            {ru ? 'Код комнаты' : 'Room code'}
          </span>
          <input
            type="text"
            value={sync.code}
            onChange={(event) => sync.setCode(event.target.value)}
            placeholder="XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            className={[
              'w-40 rounded-lg border bg-app-bg px-3 py-2 font-mono text-lg tracking-wider text-app-text uppercase outline-none focus:border-emerald-500',
              sync.code && !validCode ? 'border-red-500' : 'border-app-border',
            ].join(' ')}
          />
        </label>

        <button
          type="button"
          onClick={() => sync.setCode(generateRoomCode())}
          className="cursor-pointer rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text hover:border-emerald-500"
        >
          {ru ? 'Новый код' : 'New code'}
        </button>

        {sync.enabled ? (
          <button
            type="button"
            onClick={sync.disconnect}
            className="cursor-pointer rounded-lg border border-app-border bg-app-bg px-4 py-2 text-sm font-semibold text-app-text hover:border-red-500"
          >
            {ru ? 'Отключиться' : 'Disconnect'}
          </button>
        ) : (
          <button
            type="button"
            onClick={sync.connect}
            disabled={!validCode}
            className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-default disabled:opacity-40"
          >
            {ru ? 'Подключиться' : 'Connect'}
          </button>
        )}
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-app-muted">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${syncStatusColor(sync.status)}`}
        />
        {syncStatusText(sync.status, ru)}
        {sync.status === 'online' && (
          <span>
            · {ru ? 'в комнате ещё' : 'others in the room'}:{' '}
            {sync.peers.length === 0
              ? ru
                ? 'никого'
                : 'nobody'
              : sync.peers
                  .map((peer) =>
                    peer.role === 'gunner'
                      ? ru
                        ? 'стрелок'
                        : 'gunner'
                      : ru
                        ? 'наводчик'
                        : 'FDC'
                  )
                  .join(', ')}
          </span>
        )}
      </p>
      {!validCode && (
        <p className="mt-2 text-xs text-app-muted">
          {ru
            ? 'Наводчик жмёт «Новый код» и сообщает его стрелкам (или даёт QR-код). Все вводят один и тот же код.'
            : 'The FDC presses "New code" and gives it to the gunners (or shows the QR code). Everyone enters the same code.'}
        </p>
      )}

      {link && sync.role === 'computer' && (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-app-border pt-4">
          {qr?.link === link && (
            <img
              src={qr.image}
              width={128}
              height={128}
              alt={ru ? 'QR-код приглашения для стрелка' : 'Gunner invite QR code'}
              className="rounded-lg bg-white p-1"
            />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-app-text">
              {ru ? 'Приглашение для стрелка' : 'Invite for a gunner'}
            </p>
            <p className="mt-1 break-all text-xs text-app-muted">{link}</p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="mt-2 cursor-pointer rounded-lg border border-app-border bg-app-bg px-3 py-1 text-xs text-app-text hover:border-emerald-500"
            >
              {copied
                ? ru
                  ? 'Скопировано'
                  : 'Copied'
                : ru
                  ? 'Копировать ссылку'
                  : 'Copy link'}
            </button>
            <p className="mt-2 text-xs text-app-muted">
              {ru
                ? 'Стрелок сканирует QR-код телефоном — приложение откроется сразу в комнате.'
                : 'The gunner scans the QR code — the app opens straight in the room.'}
            </p>
          </div>
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-app-muted">
          {ru ? 'Сервер связи' : 'Relay server'}
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            value={sync.server}
            onChange={(event) =>
              sync.setServer(event.target.value as SyncServerId)
            }
            className="rounded-lg border border-app-border bg-app-bg px-3 py-1.5 text-app-text"
          >
            {SYNC_SERVERS.map((server) => (
              <option key={server.id} value={server.id}>
                {new URL(server.url).hostname}
              </option>
            ))}
          </select>
          <p className="text-xs text-app-muted">
            {ru
              ? 'Бесплатный публичный сервер MQTT. У всех в комнате должен быть один и тот же. Данные зашифрованы кодом комнаты — сервер их не видит.'
              : 'A free public MQTT server. Everyone in the room must use the same one. Data is encrypted with the room code — the server cannot read it.'}
          </p>
        </div>
      </details>
    </section>
  )
}

function ComputerView({ language }: Props) {
  const ru = language === 'ru'
  const sync = useSync()
  const now = useNow(1000)
  const gunners = sync.peers.filter((peer) => peer.role === 'gunner').length

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-4 text-sm sm:p-6">
      <p className="text-app-text">
        {ru ? 'Стрелков на связи' : 'Gunners online'}:{' '}
        <span className="font-semibold">{gunners}</span>
      </p>
      <p className="mt-1 text-app-muted">
        {sync.lastSharedAt
          ? `${ru ? 'Установки отправлены' : 'Settings sent'} ${ago(now - sync.lastSharedAt, ru)}`
          : ru
            ? 'Установки ещё не отправлялись.'
            : 'Nothing sent yet.'}
      </p>
      <p className="mt-3 text-xs text-app-muted">
        {ru
          ? 'Работайте на вкладке «Главная»: каждое изменение возвышения, азимута или заряда сразу уходит стрелкам. Когда стрелок жмёт «Выстрел», у вас запускается отсчёт до разрыва.'
          : 'Work on the Dashboard tab: every change of elevation, azimuth or charge goes to the gunners at once. When a gunner presses "Fire", your impact countdown starts.'}
      </p>
    </section>
  )
}

/** Экран стрелка: установки от наводчика, крупно, и «Выстрел». */
function GunnerView({ language }: Props) {
  const ru = language === 'ru'
  const sync = useSync()
  const now = useNow(1000)
  const timerRef = useRef<FireTimerHandle>(null)
  const [combatOpen, setCombatOpen] = useState(false)

  // Телефон у орудия не гаснет
  useWakeLock(true)

  const remote = sync.remote
  const solution = remote?.solution ?? null
  const fresh = remote !== null && now - remote.receivedAt < 3000

  // Новые установки — короткий сигнал
  const receivedAt = remote?.solution ? remote.receivedAt : null
  useEffect(() => {
    if (receivedAt !== null) beep(1200, 80)
  }, [receivedAt])

  const { onShot, sendShot } = sync
  useEffect(
    () =>
      onShot(() => {
        timerRef.current?.remoteFire()
        notifyOverlayShot()
      }),
    [onShot]
  )

  function handleFire() {
    notifyOverlayShot()
    sendShot()
  }

  useHotkeys({
    KeyF: () => timerRef.current?.fire(),
    KeyB: () => {
      if (solution) setCombatOpen((value) => !value)
    },
    Escape: () => setCombatOpen(false),
  })

  // Программа для ПК: Ctrl+Alt+F и оверлей с установками наводчика
  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'fire') timerRef.current?.fire()
      }),
    []
  )

  const overlayState: OverlayState = {
    language,
    title: solution?.title ?? (ru ? 'Связка' : 'Link'),
    targetName: solution?.targetName ?? null,
    mode: solution?.mode ?? 'HIGH',
    modes: [],
    charges: [],
    azimuthUnit: solution?.azimuthUnit ?? '',
    fields: { distance: '', azimuth: '', ownHeight: '', targetHeight: '' },
    adjust: { range: 0, lateral: 0, count: 0 },
    solution: solution
      ? {
          charge: solution.charge,
          mode: solution.mode,
          elevation: solution.elevation,
          azimuth: solution.azimuth,
          azimuthUnit: solution.azimuthUnit,
          tof: solution.tof,
        }
      : null,
    readOnly: true,
  }
  const overlayJson = JSON.stringify(overlayState)
  const overlayJsonRef = useRef(overlayJson)

  useEffect(() => {
    overlayJsonRef.current = overlayJson
    publishSolution(JSON.parse(overlayJson))
  }, [overlayJson])

  useEffect(
    () =>
      onSolutionRequest(() =>
        publishSolution(JSON.parse(overlayJsonRef.current))
      ),
    []
  )

  if (!sync.active || !solution) {
    return (
      <section className="rounded-xl border border-app-border bg-app-surface p-6 text-center text-app-muted">
        {!sync.active
          ? ru
            ? 'Нет связи с сервером — установки не обновляются.'
            : 'No connection — settings are not updating.'
          : ru
            ? 'Ждём установки от наводчика…'
            : 'Waiting for the fire direction data…'}
      </section>
    )
  }

  const big = 'font-bold leading-none tabular-nums text-app-text'

  return (
    <section
      className={[
        'rounded-xl border bg-app-surface p-4 transition-colors sm:p-6',
        fresh ? 'border-emerald-500' : 'border-app-border',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold text-app-text">
          {solution.targetName ?? solution.title}
          {solution.targetName && (
            <span className="ml-2 text-sm font-normal text-app-muted">
              {solution.title}
            </span>
          )}
        </p>
        <p
          className={[
            'text-xs',
            fresh ? 'text-emerald-600 dark:text-emerald-400' : 'text-app-muted',
          ].join(' ')}
        >
          {ru ? 'обновлено' : 'updated'} {ago(now - remote!.receivedAt, ru)}
        </p>
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm text-app-muted">
            {ru ? 'Возвышение, мил' : 'Elevation, mil'}
          </p>
          <p className={`${big} text-[clamp(3.5rem,16vw,7rem)]`}>
            {Math.round(solution.elevation)}
          </p>
        </div>
        <div>
          <p className="text-sm text-app-muted">
            {ru ? 'Азимут' : 'Azimuth'}
            {solution.azimuth !== null && `, ${solution.azimuthUnit}`}
          </p>
          <p
            className={`${big} text-[clamp(3.5rem,16vw,7rem)] ${solution.azimuth === null ? 'text-app-muted' : ''}`}
          >
            {solution.azimuth ?? '—'}
          </p>
        </div>
        <div className="flex gap-10">
          <div>
            <p className="text-sm text-app-muted">{ru ? 'Заряд' : 'Charge'}</p>
            <p className={`${big} text-5xl`}>
              {solution.charge}
              {solution.mode === 'LOW' && (
                <span className="ml-2 align-middle text-xl text-amber-600 dark:text-amber-300">
                  LOW
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-app-muted">
              {ru ? 'Полёт, с' : 'Flight, s'}
            </p>
            <p className={`${big} text-5xl`}>{solution.tof.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {!combatOpen && (
        <FireTimer
          ref={timerRef}
          tof={solution.tof}
          language={language}
          onFire={handleFire}
        />
      )}

      <button
        type="button"
        onClick={() => setCombatOpen(true)}
        className="mt-2 w-full cursor-pointer rounded-lg border border-app-border bg-app-surface px-4 py-2 text-sm text-app-text hover:border-emerald-500"
      >
        {ru ? 'Боевой экран' : 'Combat screen'}
        <span className="ml-2 hidden text-xs text-app-muted sm:inline">B</span>
      </button>

      {combatOpen && (
        <CombatScreen
          title={solution.title}
          targetName={solution.targetName}
          charge={solution.charge}
          mode={solution.mode}
          elevation={solution.elevation}
          azimuth={solution.azimuth}
          azimuthUnit={solution.azimuthUnit}
          tof={solution.tof}
          timerRef={timerRef}
          onFire={handleFire}
          onClose={() => setCombatOpen(false)}
          language={language}
        />
      )}
    </section>
  )
}

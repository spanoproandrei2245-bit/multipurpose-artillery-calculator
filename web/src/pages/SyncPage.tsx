import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

import { CombatScreen } from '../components/CombatScreen'
import { FireTimer, type FireTimerHandle } from '../components/FireTimer'
import { SectionHeading, Toggle } from '../components/FormControls'
import { PageIntro } from '../components/PageIntro'
import {
  isDesktop,
  notifyOverlayShot,
  onHotkey,
  onSolutionRequest,
  publishSolution,
  type OverlayState,
} from '../lib/desktop'
import { playSound } from '../lib/sound'
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
    <div className="space-y-4">
      <PageIntro
        index="02"
        eyebrow={ru ? 'Связка' : 'Link'}
        title={
          ru ? (
            <>
              Наводчик считает —<br />
              стрелок видит сразу
            </>
          ) : (
            <>
              The FDC computes —<br />
              gunners see it live
            </>
          )
        }
      >
        {ru
          ? 'Установки уходят стрелкам при каждом изменении. «Огонь» на любом устройстве запускает отсчёт до разрыва у всех. Данные шифруются кодом комнаты. Нужен интернет на всех устройствах.'
          : 'Settings go to the gunners on every change. "Fire" on any device starts the impact countdown everywhere. Data is encrypted with the room code. All devices need internet.'}
      </PageIntro>

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
    <section className="panel ticks p-4 sm:p-5">
      <SectionHeading
        index="01"
        title={ru ? 'Комната' : 'Room'}
        aside={
          <span className="label flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 ${syncStatusColor(sync.status)}`}
            />
            {syncStatusText(sync.status, ru)}
          </span>
        }
      />

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="label mb-1.5">
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
          <span className="label mb-1.5 block">
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
            aria-invalid={sync.code !== '' && !validCode}
            className="field w-44 font-mono text-lg tracking-[0.18em] uppercase"
          />
        </label>

        <label className="block">
          <span className="label mb-1.5 block">
            {ru ? 'Позывной' : 'Callsign'}
          </span>
          <input
            type="text"
            value={sync.callsign}
            onChange={(event) => sync.setCallsign(event.target.value)}
            placeholder={ru ? 'для меток' : 'for markers'}
            maxLength={24}
            className="field w-36 py-2 text-sm"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => sync.setCode(generateRoomCode())}
            className="btn"
          >
            {ru ? 'Новый код' : 'New code'}
          </button>

          {sync.enabled ? (
            <button
              type="button"
              onClick={sync.disconnect}
              className="btn btn-danger"
            >
              {ru ? 'Отключиться' : 'Disconnect'}
            </button>
          ) : (
            <button
              type="button"
              onClick={sync.connect}
              disabled={!validCode}
              className="btn btn-primary"
            >
              {ru ? 'Подключиться' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {sync.status === 'online' && (
        <p className="mt-4 flex flex-wrap items-center gap-2">
          <span className="label">
            {ru ? 'В комнате ещё' : 'Also in the room'}
          </span>
          {sync.peers.length === 0 ? (
            <span className="label text-app-faint">
              {ru ? 'никого' : 'nobody'}
            </span>
          ) : (
            sync.peers.map((peer) => (
              <span
                key={peer.id}
                className={`tag ${peer.role === 'gunner' ? 'tag-ok' : 'tag-accent'}`}
              >
                {peer.role === 'gunner'
                  ? ru
                    ? 'стрелок'
                    : 'gunner'
                  : ru
                    ? 'наводчик'
                    : 'FDC'}
              </span>
            ))
          )}
        </p>
      )}
      {!validCode && (
        <p className="mt-3 text-xs text-app-muted">
          {ru
            ? 'Наводчик жмёт «Новый код» и сообщает его стрелкам (или даёт QR-код). Все вводят один и тот же код.'
            : 'The FDC presses "New code" and gives it to the gunners (or shows the QR code). Everyone enters the same code.'}
        </p>
      )}

      {link && sync.role === 'computer' && (
        <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-app-border pt-5">
          {qr?.link === link && (
            <div className="ticks ticks-accent p-2">
              <img
                src={qr.image}
                width={128}
                height={128}
                alt={ru ? 'QR-код приглашения для стрелка' : 'Gunner invite QR code'}
                className="block bg-white p-1"
              />
            </div>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="label text-app-text">
              {ru ? 'Приглашение для стрелка' : 'Invite for a gunner'}
            </p>
            <p className="mt-2 font-mono text-[11px] break-all text-app-muted">
              {link}
            </p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="btn btn-sm mt-3"
            >
              {copied
                ? ru
                  ? 'Скопировано'
                  : 'Copied'
                : ru
                  ? 'Копировать ссылку'
                  : 'Copy link'}
            </button>
            <p className="mt-3 text-xs text-app-muted">
              {ru
                ? 'Стрелок сканирует QR-код телефоном — приложение откроется сразу в комнате.'
                : 'The gunner scans the QR code — the app opens straight in the room.'}
            </p>
          </div>
        </div>
      )}

      <details className="disclosure mt-5 border-t border-app-border pt-4 text-sm">
        <summary>
          <span className="label">{ru ? 'Сервер связи' : 'Relay server'}</span>
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={sync.server}
            onChange={(event) =>
              sync.setServer(event.target.value as SyncServerId)
            }
            className="field w-auto py-1.5 font-mono text-xs"
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
    <section className="panel ticks p-4 sm:p-5">
      <SectionHeading index="02" title={ru ? 'Наводчик' : 'Fire direction'} />
      <div className="mt-4 grid grid-cols-2 gap-px border border-app-border bg-app-border">
        <div className="bg-app-surface p-3">
          <p className="label">{ru ? 'Стрелков на связи' : 'Gunners online'}</p>
          <p className="readout mt-2 text-5xl">{String(gunners).padStart(2, '0')}</p>
        </div>
        <div className="bg-app-surface p-3">
          <p className="label">{ru ? 'Последняя отправка' : 'Last sent'}</p>
          <p className="mono-num mt-3 text-lg text-app-text">
            {sync.lastSharedAt
              ? ago(now - sync.lastSharedAt, ru)
              : ru
                ? 'ещё нет'
                : 'not yet'}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-app-muted">
        {ru
          ? 'Работайте на вкладке «Расчёт»: каждое изменение возвышения, азимута или заряда сразу уходит стрелкам. Когда стрелок жмёт «Огонь», у вас запускается отсчёт до разрыва.'
          : 'Work on the Solution tab: every change of elevation, azimuth or charge goes to the gunners at once. When a gunner presses "Fire", your impact countdown starts.'}
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
    if (receivedAt !== null) playSound('syncUpdate')
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
      <section className="panel ticks p-10 text-center">
        <p className="label">
          {!sync.active
            ? ru
              ? 'Нет связи с сервером — установки не обновляются'
              : 'No connection — settings are not updating'
            : ru
              ? 'Ждём установки от наводчика…'
              : 'Waiting for the fire direction data…'}
        </p>
      </section>
    )
  }

  return (
    <section
      className={[
        'panel ticks p-4 transition-colors sm:p-5',
        fresh ? 'ticks-accent border-accent' : '',
      ].join(' ')}
    >
      <SectionHeading
        index="02"
        title={ru ? 'Установки от наводчика' : 'Settings from the FDC'}
        aside={
          <span className={`tag ${fresh ? 'tag-accent' : ''}`}>
            {ru ? 'обновлено' : 'updated'} {ago(now - remote!.receivedAt, ru)}
          </span>
        }
      />
      <p className="mt-3 text-xl font-light text-app-text">
        {solution.targetName ?? solution.title}
        {solution.targetName && (
          <span className="label ml-3">{solution.title}</span>
        )}
      </p>

      <div className="mt-4 grid gap-px border border-app-border bg-app-border sm:grid-cols-2">
        <div className="bg-app-surface p-4">
          <p className="label">
            {ru ? 'Возвышение' : 'Elevation'} · {ru ? 'мил' : 'mil'}
          </p>
          <p className="readout mt-3 text-[clamp(4rem,18vw,7.5rem)]">
            {Math.round(solution.elevation)}
          </p>
        </div>
        <div className="bg-app-surface p-4">
          <p className="label">
            {ru ? 'Азимут' : 'Azimuth'}
            {solution.azimuth !== null && ` · ${solution.azimuthUnit}`}
          </p>
          <p
            className={[
              'readout mt-3 text-[clamp(4rem,18vw,7.5rem)]',
              solution.azimuth === null ? 'text-app-faint' : '',
            ].join(' ')}
          >
            {solution.azimuth ?? '——'}
          </p>
        </div>
        <div className="flex gap-10 bg-app-surface p-4 sm:col-span-2">
          <div>
            <p className="label">{ru ? 'Заряд' : 'Charge'}</p>
            <p className="readout mt-2 flex items-baseline gap-3 text-5xl">
              {String(solution.charge).padStart(2, '0')}
              {solution.mode === 'LOW' && (
                <span className="tag tag-warn">LOW</span>
              )}
            </p>
          </div>
          <div>
            <p className="label">
              {ru ? 'Полёт' : 'Flight'} · {ru ? 'с' : 's'}
            </p>
            <p className="readout mt-2 text-5xl">{solution.tof.toFixed(1)}</p>
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
        className="btn mt-2 w-full"
      >
        {ru ? 'Боевой экран' : 'Combat screen'}
        <span className="kbd hidden sm:inline-block">B</span>
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

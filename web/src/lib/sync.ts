import type { ArtilleryMode } from '../types/artillery'
import { parseMarker, type MapMarker } from './markers'

/**
 * Связка наводчик ↔ стрелок: общее для всех устройств.
 *
 * Устройства встречаются в «комнате» на публичном MQTT-брокере.
 * Из кода комнаты (PBKDF2) получаются ключ AES-GCM и имя канала:
 * брокер и посторонние видят только шифр, а по имени канала код
 * не подобрать быстрее, чем перебором PBKDF2.
 */

/** Кто на этом устройстве: считает или стреляет. */
export type SyncRole = 'computer' | 'gunner'

export const SYNC_ROLES: readonly SyncRole[] = ['computer', 'gunner']

/** Опубликованный сайт: ссылка-приглашение из программы для ПК ведёт сюда. */
export const PUBLIC_SITE_URL =
  'https://spanoproandrei2245-bit.github.io/multipurpose-artillery-calculator/'

/** Публичные брокеры MQTT через WebSocket (без регистрации). */
export const SYNC_SERVERS = [
  { id: 'hivemq', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { id: 'emqx', url: 'wss://broker.emqx.io:8084/mqtt' },
  { id: 'mosquitto', url: 'wss://test.mosquitto.org:8081' },
] as const

export type SyncServerId = (typeof SYNC_SERVERS)[number]['id']

export const SYNC_SERVER_IDS: readonly SyncServerId[] = SYNC_SERVERS.map(
  (server) => server.id
)

/** Установки, которые наводчик отправляет стрелку. */
export interface SyncSolution {
  title: string
  targetName: string | null
  charge: number
  mode: ArtilleryMode
  elevation: number
  azimuth: string | null
  azimuthUnit: string
  tof: number
  // Огонь по времени: момент разрыва, мс (часы устройства); null — нет
  tot?: number | null
}

export type SyncMessage =
  // Наводчик → стрелки; хранится на брокере (retain) для опоздавших.
  // null — решения нет (цель сброшена).
  | { kind: 'solution'; from: string; sentAt: number; solution: SyncSolution | null }
  // Выстрел с любого устройства: отсчёт до разрыва у всех
  | { kind: 'shot'; from: string; sentAt: number }
  // «Я в сети» — раз в несколько секунд
  | { kind: 'hello'; from: string; sentAt: number; role: SyncRole }
  // Метка на карте; хранится на брокере (retain) в своём канале
  | { kind: 'marker'; from: string; sentAt: number; marker: MapMarker }

// Без похожих символов: 0/O, 1/I/L — код диктуют голосом.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_LENGTH = 8

/** Новый случайный код комнаты вида XXXX-XXXX. */
export function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length])
  return formatRoomCode(chars.join(''))
}

/** Код в каноническом виде: заглавные, без пробелов и дефисов. */
export function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s-]/g, '')
}

export function formatRoomCode(value: string): string {
  const code = normalizeRoomCode(value)
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

export function isValidRoomCode(value: string): boolean {
  const code = normalizeRoomCode(value)
  return (
    code.length === CODE_LENGTH &&
    [...code].every((char) => ALPHABET.includes(char))
  )
}

export interface Room {
  // Канал на брокере: <topic>/state и <topic>/events
  topic: string
  key: CryptoKey
}

const SALT = new TextEncoder().encode('artillery-calculator/sync/v1')
const ITERATIONS = 100_000

/** Канал и ключ комнаты из кода. */
export async function deriveRoom(code: string): Promise<Room> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizeRoomCode(code)),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: ITERATIONS },
      material,
      384
    )
  )
  // Первые 256 бит — ключ, остальные 128 — имя канала
  const key = await crypto.subtle.importKey(
    'raw',
    bits.slice(0, 32),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
  const id = Array.from(bits.slice(32), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  return { topic: `artillery-calculator/v1/${id}`, key }
}

const IV_LENGTH = 12

/** Сообщение → nonce + шифр AES-GCM. */
export async function encryptMessage(
  key: CryptoKey,
  message: SyncMessage
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const data = new TextEncoder().encode(JSON.stringify(message))
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  )
  const packet = new Uint8Array(IV_LENGTH + sealed.length)
  packet.set(iv)
  packet.set(sealed, IV_LENGTH)
  return packet
}

/** Расшифровка; null — чужой ключ, повреждение или не наш формат. */
export async function decryptMessage(
  key: CryptoKey,
  packet: Uint8Array
): Promise<SyncMessage | null> {
  if (packet.length <= IV_LENGTH) return null
  try {
    const data = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packet.slice(0, IV_LENGTH) },
      key,
      packet.slice(IV_LENGTH)
    )
    return parseMessage(JSON.parse(new TextDecoder().decode(data)))
  } catch {
    return null
  }
}

/** Пакет ↔ текст для брокера (base64). */
export function packetToText(packet: Uint8Array): string {
  let binary = ''
  for (const byte of packet) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function textToPacket(text: string): Uint8Array {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
  } catch {
    return new Uint8Array()
  }
}

/** Приглашение по ссылке: …?room=XXXX-XXXX&server=hivemq — для стрелка. */
export function readInvite(
  search: string
): { code: string; server: SyncServerId } | null {
  const params = new URLSearchParams(search)
  const code = params.get('room') ?? ''
  if (!isValidRoomCode(code)) return null
  const server = SYNC_SERVER_IDS.find((id) => id === params.get('server'))
  return { code: formatRoomCode(code), server: server ?? 'hivemq' }
}

/** Ссылка-приглашение в комнату для стрелка. */
export function inviteLink(
  page: string,
  code: string,
  server: SyncServerId
): string {
  const url = new URL(page)
  url.hash = ''
  url.search = new URLSearchParams({
    room: formatRoomCode(code),
    server,
  }).toString()
  return url.toString()
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isString = (value: unknown): value is string => typeof value === 'string'

function parseSolution(value: unknown): SyncSolution | null | undefined {
  if (value === null) return null
  if (typeof value !== 'object') return undefined
  const s = value as Record<string, unknown>
  const valid =
    isString(s.title) &&
    (s.targetName === null || isString(s.targetName)) &&
    isNumber(s.charge) &&
    (s.mode === 'HIGH' || s.mode === 'LOW') &&
    isNumber(s.elevation) &&
    (s.azimuth === null || isString(s.azimuth)) &&
    isString(s.azimuthUnit) &&
    isNumber(s.tof) &&
    s.tof > 0 &&
    (s.tot === undefined || s.tot === null || isNumber(s.tot))
  if (!valid) return undefined
  return {
    title: s.title as string,
    targetName: s.targetName as string | null,
    charge: s.charge as number,
    mode: s.mode as ArtilleryMode,
    elevation: s.elevation as number,
    azimuth: s.azimuth as string | null,
    azimuthUnit: s.azimuthUnit as string,
    tof: s.tof as number,
    tot: (s.tot as number | null | undefined) ?? null,
  }
}

/** Проверка формы сообщения (другая версия приложения, мусор). */
export function parseMessage(value: unknown): SyncMessage | null {
  if (typeof value !== 'object' || value === null) return null
  const m = value as Record<string, unknown>
  if (!isString(m.from) || !isNumber(m.sentAt)) return null
  const base = { from: m.from, sentAt: m.sentAt }

  switch (m.kind) {
    case 'solution': {
      const solution = parseSolution(m.solution)
      return solution === undefined ? null : { kind: 'solution', ...base, solution }
    }
    case 'shot':
      return { kind: 'shot', ...base }
    case 'marker': {
      const marker = parseMarker(m.marker)
      return marker ? { kind: 'marker', ...base, marker } : null
    }
    case 'hello':
      return m.role === 'computer' || m.role === 'gunner'
        ? { kind: 'hello', ...base, role: m.role }
        : null
    default:
      return null
  }
}

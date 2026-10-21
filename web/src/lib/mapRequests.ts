/**
 * Заявки на новые карты и голоса за них — без сервера и без GitHub.
 *
 * Данные лежат на тех же публичных MQTT-брокерах, что и «Связка», как
 * удерживаемые (retained) сообщения:
 *   artcalc-maps/v1/req/<номер мода>/info        — {"name": "…"}
 *   artcalc-maps/v1/req/<номер мода>/v/<device>  — "1" (голос этого устройства)
 * Читающему брокер отдаёт всё, что накопилось, поэтому список видно сразу,
 * а голоса считаются по числу разных устройств. Пишем и читаем на всех
 * брокерах сразу: если один недоступен или забыл данные, остальные помнят.
 *
 * Честно о границах: это публичные брокеры без учётных записей — голос
 * одного устройства один, но накрутить его, зная устройство-идентификатор
 * в коде, может любой; хозяин приложения видит список и решает сам.
 */

export const TOPIC_ROOT = 'artcalc-maps/v1/req'
export const MAX_NAME = 60

export interface WorkshopLink {
  id: string
  url: string
}

function linkFor(id: string): WorkshopLink {
  return {
    id,
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
  }
}

/** Ссылка на мод в Steam Workshop → номер мода и «чистая» ссылка; иначе null. */
export function parseWorkshopLink(input: string): WorkshopLink | null {
  const text = input.trim()
  if (!text) return null
  // Только номер мода тоже годится
  const bare = text.match(/^\d{6,12}$/)
  if (bare) return linkFor(bare[0])
  const match = text.match(
    /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(?:sharedfiles|workshop)\/filedetails\/?\?(?:[^#\s]*&)?id=(\d{6,12})(?:[&#].*)?$/i
  )
  if (match) return linkFor(match[1])
  const proto = text.match(/^steam:\/\/url\/CommunityFilePage\/(\d{6,12})$/i)
  if (proto) return linkFor(proto[1])
  return null
}

export function infoTopic(workshopId: string): string {
  return `${TOPIC_ROOT}/${workshopId}/info`
}

export function voteTopic(workshopId: string, device: string): string {
  return `${TOPIC_ROOT}/${workshopId}/v/${device}`
}

export type ParsedTopic =
  | { kind: 'info'; workshopId: string }
  | { kind: 'vote'; workshopId: string; device: string }

/** Разбор темы сообщения; null — не наша или с подозрительным содержимым. */
export function parseTopic(topic: string): ParsedTopic | null {
  if (!topic.startsWith(`${TOPIC_ROOT}/`)) return null
  const rest = topic.slice(TOPIC_ROOT.length + 1).split('/')
  if (!/^\d{6,12}$/.test(rest[0] ?? '')) return null
  if (rest.length === 2 && rest[1] === 'info') {
    return { kind: 'info', workshopId: rest[0] }
  }
  if (rest.length === 3 && rest[1] === 'v' && /^[0-9a-f]{8,32}$/.test(rest[2])) {
    return { kind: 'vote', workshopId: rest[0], device: rest[2] }
  }
  return null
}

export interface MapRequest {
  workshopId: string
  name: string
  votes: number
  // Голосовало ли это устройство
  mine: boolean
}

/** Сводка по сообщениям брокеров: заявки и голоса (одно устройство — один голос). */
export class Tally {
  private info = new Map<string, string>()
  private votes = new Map<string, Set<string>>()

  /** Сообщение брокера; пустое тело у retained-темы — отзыв (голоса или заявки). */
  apply(topic: string, payload: string) {
    const parsed = parseTopic(topic)
    if (!parsed) return
    if (parsed.kind === 'info') {
      if (payload === '') {
        this.info.delete(parsed.workshopId)
        return
      }
      try {
        const data = JSON.parse(payload) as { name?: unknown }
        const name = typeof data.name === 'string' ? data.name.trim().slice(0, MAX_NAME) : ''
        // Без названия заявка всё равно показывается — по номеру мода
        this.info.set(parsed.workshopId, name || `Workshop ${parsed.workshopId}`)
      } catch {
        // Мусор в теме — пропускаем
      }
      return
    }
    const set = this.votes.get(parsed.workshopId) ?? new Set<string>()
    if (payload === '1') set.add(parsed.device)
    else set.delete(parsed.device)
    this.votes.set(parsed.workshopId, set)
  }

  /** Список заявок по убыванию голосов (при равенстве — по названию). */
  snapshot(device: string): MapRequest[] {
    return [...this.info.entries()]
      .map(([workshopId, name]) => {
        const set = this.votes.get(workshopId)
        return {
          workshopId,
          name,
          votes: set?.size ?? 0,
          mine: set?.has(device) ?? false,
        }
      })
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
  }
}

export type RequestsStatus = 'connecting' | 'ready' | 'offline'

export interface RequestsSession {
  /** Проголосовать за заявку (или снять голос). */
  vote: (workshopId: string, on: boolean) => void
  /** Новая заявка с первым голосом. */
  suggest: (link: WorkshopLink, name: string) => void
  close: () => void
}

/**
 * Открыть сессию: подключиться ко всем брокерам, собирать заявки и голоса.
 * onUpdate вызывается при каждом изменении, onStatus — при смене состояния.
 */
export async function openRequests(
  servers: readonly string[],
  device: string,
  onUpdate: (requests: MapRequest[]) => void,
  onStatus: (status: RequestsStatus) => void
): Promise<RequestsSession> {
  const mqtt = await import('mqtt')
  // Сборка mqtt — CommonJS: в разработке Vite отдаёт её только как default
  const connect = mqtt.connect ?? mqtt.default.connect

  const tally = new Tally()
  const clients: ReturnType<typeof connect>[] = []
  let online = 0
  let closed = false
  let settle: ReturnType<typeof setTimeout> | undefined

  const emit = () => {
    if (!closed) onUpdate(tally.snapshot(device))
  }

  onStatus('connecting')
  const timeout = setTimeout(() => {
    if (online === 0 && !closed) onStatus('offline')
  }, 9000)

  for (const [index, url] of servers.entries()) {
    const client = connect(url, {
      clientId: `artcalc_req_${device}_${index}`,
      reconnectPeriod: 4000,
      connectTimeout: 8000,
      clean: true,
    })
    clients.push(client)
    client.on('connect', () => {
      online += 1
      client.subscribe(`${TOPIC_ROOT}/#`, { qos: 1 })
      // Брокер присылает накопленное пачкой — показываем, когда пачка улеглась
      clearTimeout(settle)
      settle = setTimeout(() => {
        if (!closed) onStatus('ready')
        emit()
      }, 1200)
    })
    client.on('close', () => {
      online = Math.max(0, online - 1)
      if (online === 0 && !closed) onStatus('connecting')
    })
    client.on('error', () => {})
    client.on('message', (topic, payload) => {
      if (payload.length > 400) return
      tally.apply(topic, payload.toString())
      emit()
    })
  }

  function publishAll(topic: string, payload: string) {
    // Свои изменения сразу видны и локально, не дожидаясь брокера
    tally.apply(topic, payload)
    emit()
    for (const client of clients) {
      if (client.connected) client.publish(topic, payload, { qos: 1, retain: true })
    }
  }

  return {
    vote(workshopId, on) {
      publishAll(voteTopic(workshopId, device), on ? '1' : '')
    },
    suggest(link, name) {
      publishAll(
        infoTopic(link.id),
        JSON.stringify({ name: name.trim().slice(0, MAX_NAME) })
      )
      publishAll(voteTopic(link.id, device), '1')
    },
    close() {
      closed = true
      clearTimeout(timeout)
      clearTimeout(settle)
      for (const client of clients) client.end(true)
    },
  }
}

import { describe, expect, it, vi } from 'vitest'

import {
  infoTopic,
  openRequests,
  parseTopic,
  parseWorkshopLink,
  Tally,
  voteTopic,
} from './mapRequests'

const DEVICE_A = 'aaaaaaaaaaaaaaaa'
const DEVICE_B = 'bbbbbbbbbbbbbbbb'

describe('parseWorkshopLink', () => {
  it('понимает обычную ссылку на мод', () => {
    expect(
      parseWorkshopLink('https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890')
    ).toEqual({
      id: '1234567890',
      url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890',
    })
  })

  it('понимает ссылку без https, с лишними параметрами и пробелами', () => {
    expect(
      parseWorkshopLink('  steamcommunity.com/sharedfiles/filedetails/?l=russian&id=987654321&searchtext=map  ')
        ?.id
    ).toBe('987654321')
  })

  it('понимает steam:// и просто номер', () => {
    expect(parseWorkshopLink('steam://url/CommunityFilePage/1122334455')?.id).toBe('1122334455')
    expect(parseWorkshopLink('1122334455')?.id).toBe('1122334455')
  })

  it('отвергает чужое', () => {
    expect(parseWorkshopLink('')).toBeNull()
    expect(parseWorkshopLink('https://example.com/?id=123456789')).toBeNull()
    expect(parseWorkshopLink('https://steamcommunity.com/id/someone')).toBeNull()
    expect(parseWorkshopLink('12')).toBeNull()
  })
})

describe('темы MQTT', () => {
  it('собирает и разбирает темы заявки и голоса', () => {
    expect(parseTopic(infoTopic('1234567890'))).toEqual({ kind: 'info', workshopId: '1234567890' })
    expect(parseTopic(voteTopic('1234567890', DEVICE_A))).toEqual({
      kind: 'vote',
      workshopId: '1234567890',
      device: DEVICE_A,
    })
  })

  it('чужие и подозрительные темы отбрасываются', () => {
    expect(parseTopic('other/1234567890/info')).toBeNull()
    expect(parseTopic('artcalc-maps/v1/req/abc/info')).toBeNull()
    expect(parseTopic('artcalc-maps/v1/req/1234567890/v/NOT HEX')).toBeNull()
    expect(parseTopic('artcalc-maps/v1/req/1234567890/other')).toBeNull()
    expect(parseTopic('artcalc-maps/v1/req/1234567890/info/extra')).toBeNull()
  })
})

describe('Tally', () => {
  const info = (id: string, name: string) =>
    [infoTopic(id), JSON.stringify({ name })] as const

  it('считает голоса по разным устройствам и сортирует по убыванию', () => {
    const tally = new Tally()
    tally.apply(...info('111111111', 'Map A'))
    tally.apply(...info('222222222', 'Map B'))
    tally.apply(voteTopic('111111111', DEVICE_A), '1')
    tally.apply(voteTopic('222222222', DEVICE_A), '1')
    tally.apply(voteTopic('222222222', DEVICE_B), '1')
    expect(tally.snapshot(DEVICE_A).map((r) => [r.name, r.votes])).toEqual([
      ['Map B', 2],
      ['Map A', 1],
    ])
  })

  it('одно устройство — один голос, сколько ни присылай', () => {
    const tally = new Tally()
    tally.apply(...info('111111111', 'Map A'))
    for (let i = 0; i < 5; i += 1) tally.apply(voteTopic('111111111', DEVICE_A), '1')
    expect(tally.snapshot(DEVICE_B)[0].votes).toBe(1)
  })

  it('пустое сообщение снимает голос; mine показывает голос этого устройства', () => {
    const tally = new Tally()
    tally.apply(...info('111111111', 'Map A'))
    tally.apply(voteTopic('111111111', DEVICE_A), '1')
    expect(tally.snapshot(DEVICE_A)[0]).toMatchObject({ votes: 1, mine: true })
    expect(tally.snapshot(DEVICE_B)[0]).toMatchObject({ votes: 1, mine: false })
    tally.apply(voteTopic('111111111', DEVICE_A), '')
    expect(tally.snapshot(DEVICE_A)[0]).toMatchObject({ votes: 0, mine: false })
  })

  it('голоса без заявки не показываются, отзыв заявки её убирает', () => {
    const tally = new Tally()
    tally.apply(voteTopic('333333333', DEVICE_A), '1')
    expect(tally.snapshot(DEVICE_A)).toEqual([])
    tally.apply(...info('333333333', 'Map C'))
    expect(tally.snapshot(DEVICE_A)).toHaveLength(1)
    tally.apply(infoTopic('333333333'), '')
    expect(tally.snapshot(DEVICE_A)).toEqual([])
  })

  it('название обрезается, мусор и пустое название не ломают список', () => {
    const tally = new Tally()
    tally.apply(...info('111111111', 'x'.repeat(200)))
    tally.apply(infoTopic('222222222'), '{not json')
    tally.apply(infoTopic('444444444'), JSON.stringify({ name: '  ' }))
    const list = tally.snapshot(DEVICE_A)
    expect(list.find((r) => r.workshopId === '111111111')?.name).toHaveLength(60)
    expect(list.find((r) => r.workshopId === '222222222')).toBeUndefined()
    expect(list.find((r) => r.workshopId === '444444444')?.name).toBe('Workshop 444444444')
  })
})

// Подменный клиент MQTT: запоминает публикации и даёт «прислать» сообщения брокера.
const clients: FakeClient[] = []
type Handler = (...args: unknown[]) => void

class FakeClient {
  connected = false
  published: { topic: string; payload: string; retain: boolean }[] = []
  subscribed: string[] = []
  ended = false
  private handlers = new Map<string, Handler[]>()
  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    return this
  }
  emit(event: string, ...args: unknown[]) {
    for (const h of this.handlers.get(event) ?? []) h(...args)
  }
  subscribe(topic: string) {
    this.subscribed.push(topic)
  }
  publish(topic: string, payload: string, options: { retain: boolean }) {
    this.published.push({ topic, payload, retain: options.retain })
  }
  end() {
    this.ended = true
  }
}

vi.mock('mqtt', () => ({
  connect: () => {
    const client = new FakeClient()
    clients.push(client)
    return client
  },
}))

describe('openRequests', () => {
  it('подключается ко всем брокерам, собирает заявки и публикует голоса на все', async () => {
    vi.useFakeTimers()
    clients.length = 0
    const updates: unknown[] = []
    const statuses: string[] = []
    const session = await openRequests(
      ['wss://a', 'wss://b'],
      DEVICE_A,
      (list) => updates.push(list),
      (status) => statuses.push(status)
    )
    expect(clients).toHaveLength(2)
    for (const c of clients) {
      c.connected = true
      c.emit('connect')
    }
    expect(clients.every((c) => c.subscribed.includes('artcalc-maps/v1/req/#'))).toBe(true)

    // Брокер присылает накопленное
    clients[0].emit(
      'message',
      infoTopic('111111111'),
      Buffer.from(JSON.stringify({ name: 'Malden' }))
    )
    clients[0].emit('message', voteTopic('111111111', DEVICE_B), Buffer.from('1'))
    vi.advanceTimersByTime(1500)
    expect(statuses).toContain('ready')
    const last = updates[updates.length - 1] as { name: string; votes: number }[]
    expect(last[0]).toMatchObject({ name: 'Malden', votes: 1 })

    // Голос уходит на оба брокера retained
    session.vote('111111111', true)
    for (const c of clients) {
      expect(c.published).toContainEqual({
        topic: voteTopic('111111111', DEVICE_A),
        payload: '1',
        retain: true,
      })
    }
    // Снятие голоса — пустое retained-сообщение
    session.vote('111111111', false)
    expect(clients[0].published.at(-1)).toEqual({
      topic: voteTopic('111111111', DEVICE_A),
      payload: '',
      retain: true,
    })

    // Новая заявка: описание и первый голос
    session.suggest({ id: '222222222', url: 'x' }, '  Tembelan  ')
    const topics = clients[1].published.map((p) => p.topic)
    expect(topics).toContain(infoTopic('222222222'))
    expect(topics).toContain(voteTopic('222222222', DEVICE_A))

    session.close()
    expect(clients.every((c) => c.ended)).toBe(true)
    vi.useRealTimers()
  })

  it('слишком большие сообщения игнорируются', async () => {
    vi.useFakeTimers()
    clients.length = 0
    const updates: { name: string }[][] = []
    await openRequests(['wss://a'], DEVICE_A, (l) => updates.push(l), () => {})
    clients[0].connected = true
    clients[0].emit('connect')
    clients[0].emit('message', infoTopic('111111111'), Buffer.from('x'.repeat(500)))
    vi.advanceTimersByTime(2000)
    expect(updates.flat()).toEqual([])
    vi.useRealTimers()
  })
})

describe('орудия: свой раздел тем', () => {
  it('заявки на орудия и на карты не смешиваются', async () => {
    const { REQUEST_ROOTS } = await import('./mapRequests')
    expect(REQUEST_ROOTS.weapon).not.toBe(REQUEST_ROOTS.map)
    const weapons = new Tally(REQUEST_ROOTS.weapon)
    weapons.apply(infoTopic('111111111', REQUEST_ROOTS.weapon), JSON.stringify({ name: 'Sholef' }))
    weapons.apply(voteTopic('111111111', DEVICE_A, REQUEST_ROOTS.weapon), '1')
    // тема карты в сводке орудий не учитывается
    weapons.apply(infoTopic('222222222'), JSON.stringify({ name: 'Malden' }))
    expect(weapons.snapshot(DEVICE_A).map((r) => [r.name, r.votes])).toEqual([['Sholef', 1]])
    expect(parseTopic(infoTopic('111111111', REQUEST_ROOTS.weapon))).toBeNull()
  })

  it('сессия для орудий подписывается на свой раздел', async () => {
    vi.useFakeTimers()
    clients.length = 0
    const session = await openRequests(['wss://a'], DEVICE_A, () => {}, () => {}, 'weapon')
    clients[0].connected = true
    clients[0].emit('connect')
    expect(clients[0].subscribed).toEqual(['artcalc-weapons/v1/req/#'])
    session.suggest({ id: '333333333', url: 'x' }, 'M777')
    expect(clients[0].published.map((p) => p.topic)).toContain(
      'artcalc-weapons/v1/req/333333333/info'
    )
    session.close()
    vi.useRealTimers()
  })
})

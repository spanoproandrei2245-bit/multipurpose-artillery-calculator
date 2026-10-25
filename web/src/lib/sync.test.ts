import { describe, expect, it } from 'vitest'

import {
  decryptMessage,
  deriveRoom,
  encryptMessage,
  formatRoomCode,
  generateRoomCode,
  inviteLink,
  isValidRoomCode,
  normalizeRoomCode,
  packetToText,
  ReplayGuard,
  MAX_EVENT_AGE_MS,
  parseMessage,
  readInvite,
  textToPacket,
  type SyncMessage,
} from './sync'

const solution: SyncMessage = {
  kind: 'solution',
  from: 'a1',
  sentAt: 1_700_000_000_000,
  solution: {
    title: 'M252',
    targetName: 'Цель 1',
    charge: 2,
    mode: 'HIGH',
    elevation: 1123.4,
    azimuth: '3218',
    azimuthUnit: 'мил',
    tof: 24.3,
    tot: null,
  },
}

describe('room code', () => {
  it('generates valid XXXX-XXXX codes', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)
      expect(isValidRoomCode(code)).toBe(true)
    }
  })

  it('accepts lowercase, spaces and missing dash', () => {
    expect(normalizeRoomCode(' k7p4-qx9a ')).toBe('K7P4QX9A')
    expect(formatRoomCode('k7p4qx9a')).toBe('K7P4-QX9A')
    expect(isValidRoomCode('k7p4 qx9a')).toBe(true)
  })

  it('rejects wrong length and ambiguous characters', () => {
    expect(isValidRoomCode('K7P4-QX9')).toBe(false)
    expect(isValidRoomCode('K7P4-QX9AB')).toBe(false)
    expect(isValidRoomCode('K7P4-QX0A')).toBe(false)
    expect(isValidRoomCode('K7P4-QXIA')).toBe(false)
  })
})

describe('room keys', () => {
  it('derives the same topic for the same code in any spelling', async () => {
    const a = await deriveRoom('K7P4-QX9A')
    const b = await deriveRoom('k7p4qx9a')
    const c = await deriveRoom('K7P4-QX9B')
    expect(a.topic).toBe(b.topic)
    expect(a.topic).not.toBe(c.topic)
    // Имя канала не содержит сам код
    expect(a.topic).not.toContain('K7P4')
  })

  it('round-trips a message and rejects a foreign key', async () => {
    const room = await deriveRoom('K7P4-QX9A')
    const other = await deriveRoom('K7P4-QX9B')
    const packet = await encryptMessage(room.key, solution)

    expect(await decryptMessage(room.key, packet)).toEqual(solution)
    expect(await decryptMessage(other.key, packet)).toBeNull()
  })

  it('rejects tampered and truncated packets', async () => {
    const room = await deriveRoom('K7P4-QX9A')
    const packet = await encryptMessage(room.key, solution)
    const tampered = packet.slice()
    tampered[tampered.length - 1] ^= 1

    expect(await decryptMessage(room.key, tampered)).toBeNull()
    expect(await decryptMessage(room.key, packet.slice(0, 10))).toBeNull()
  })
})

describe('parseMessage', () => {
  it('accepts every message kind', () => {
    expect(parseMessage(solution)).toEqual(solution)
    expect(
      parseMessage({ kind: 'solution', from: 'a', sentAt: 1, solution: null })
    ).toEqual({ kind: 'solution', from: 'a', sentAt: 1, solution: null })
    expect(parseMessage({ kind: 'shot', from: 'a', sentAt: 1 })).toEqual({
      kind: 'shot',
      from: 'a',
      sentAt: 1,
    })
    expect(
      parseMessage({ kind: 'hello', from: 'a', sentAt: 1, role: 'gunner' })
    ).toEqual({ kind: 'hello', from: 'a', sentAt: 1, role: 'gunner' })
  })

  it('reads the time on target and fills it in for older senders', () => {
    const fields = (solution as Extract<SyncMessage, { kind: 'solution' }>)
      .solution!
    const message = (tot: unknown) => ({
      ...solution,
      solution: { ...fields, tot },
    })

    expect(parseMessage(message(1_700_000_060_000))).toEqual(
      message(1_700_000_060_000)
    )
    // Версии до 0.12 не присылают tot
    expect(parseMessage(message(undefined))).toEqual(solution)
    expect(parseMessage(message('now'))).toBeNull()
  })

  it('drops extra fields', () => {
    const parsed = parseMessage({ kind: 'shot', from: 'a', sentAt: 1, x: 1 })
    expect(parsed).toEqual({ kind: 'shot', from: 'a', sentAt: 1 })
  })

  it('rejects malformed messages', () => {
    expect(parseMessage(null)).toBeNull()
    expect(parseMessage('shot')).toBeNull()
    expect(parseMessage({ kind: 'shot', sentAt: 1 })).toBeNull()
    expect(parseMessage({ kind: 'boom', from: 'a', sentAt: 1 })).toBeNull()
    expect(
      parseMessage({ kind: 'hello', from: 'a', sentAt: 1, role: 'boss' })
    ).toBeNull()
    expect(
      parseMessage({
        ...solution,
        solution: { ...solution.solution, tof: 0 },
      })
    ).toBeNull()
    expect(
      parseMessage({
        ...solution,
        solution: { ...solution.solution, mode: 'MID' },
      })
    ).toBeNull()
  })
})

describe('transport helpers', () => {
  it('round-trips packets through text', () => {
    const packet = Uint8Array.from([0, 1, 127, 128, 255])
    expect(textToPacket(packetToText(packet))).toEqual(packet)
    expect(textToPacket('%%%')).toEqual(new Uint8Array())
  })

  it('reads an invite link', () => {
    expect(readInvite('?room=k7p4qx9a&server=emqx')).toEqual({
      code: 'K7P4-QX9A',
      server: 'emqx',
    })
    expect(readInvite('?room=K7P4-QX9A&server=evil')).toEqual({
      code: 'K7P4-QX9A',
      server: 'hivemq',
    })
    expect(readInvite('?room=nope')).toBeNull()
    expect(readInvite('')).toBeNull()
  })

  it('builds an invite link that reads back', () => {
    const link = inviteLink(
      'https://example.github.io/calc/?x=1#overlay',
      'K7P4QX9A',
      'emqx'
    )
    expect(link).toBe(
      'https://example.github.io/calc/?room=K7P4-QX9A&server=emqx'
    )
    expect(readInvite(new URL(link).search)?.code).toBe('K7P4-QX9A')
  })
})

describe('ReplayGuard', () => {
  const now = 1_700_000_000_000

  it('пропускает новое сообщение и отбрасывает его повтор', () => {
    const guard = new ReplayGuard()
    const shot = { kind: 'shot' as const, from: 'a', sentAt: now - 1000 }
    expect(guard.accept(shot, now)).toBe(true)
    expect(guard.accept({ ...shot }, now + 500)).toBe(false)
  })

  it('старый выстрел и старый «я в сети» не принимаются', () => {
    const guard = new ReplayGuard()
    expect(guard.accept({ kind: 'shot', from: 'a', sentAt: now - MAX_EVENT_AGE_MS - 1 }, now)).toBe(false)
    expect(guard.accept({ kind: 'hello', from: 'a', sentAt: now - MAX_EVENT_AGE_MS - 1, role: 'gunner' }, now)).toBe(false)
    expect(guard.accept({ kind: 'hello', from: 'a', sentAt: now - 5000, role: 'gunner' }, now)).toBe(true)
  })

  it('решение старее уже показанного не заменяет его', () => {
    const guard = new ReplayGuard()
    const solution = (sentAt: number) => ({ kind: 'solution' as const, from: 'fdc', sentAt, solution: null })
    expect(guard.accept(solution(now - 60_000), now)).toBe(true)
    expect(guard.accept(solution(now - 10_000), now)).toBe(true)
    // Перехваченное раньше решение, присланное снова, — отброшено
    expect(guard.accept(solution(now - 30_000), now)).toBe(false)
    // Сохранённое на брокере решение может быть старым — принимается, если новее показанного
    expect(guard.accept(solution(now - 1000), now)).toBe(true)
  })
})

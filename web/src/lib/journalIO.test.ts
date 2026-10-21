import { describe, expect, it, vi } from 'vitest'

import { exportJournal, type JournalEntry } from './journal'
import { describeImport } from './journalIO'

const ENTRY: JournalEntry = {
  id: 'a',
  name: 'Вышка',
  createdAt: '2026-10-13T10:00:00.000Z',
  dayKey: '2026-10-13',
  modelId: 'mk6',
  ammoId: 'default',
  charge: 1,
  distance: 1200,
  ownHeight: 10,
  targetHeight: 20,
  rangeCorrection: 0,
  elevation: 1270,
  tof: 27.1,
}

describe('describeImport', () => {
  it('сообщает, сколько добавлено и сколько уже было', () => {
    const onImport = vi.fn(() => ({ added: 1, skipped: 2 }))
    const text = exportJournal([ENTRY])
    expect(describeImport(text, onImport, true)).toBe('Добавлено: 1. Уже были: 2.')
    expect(describeImport(text, onImport, false)).toBe('Added: 1. Already present: 2.')
    expect(onImport).toHaveBeenCalledWith([ENTRY])
  })

  it('упоминает повреждённые записи', () => {
    const text = JSON.stringify({
      app: 'multipurpose-artillery-calculator',
      version: 1,
      entries: [ENTRY, { broken: true }],
    })
    const message = describeImport(text, () => ({ added: 1, skipped: 0 }), true)
    expect(message).toContain('Повреждённых: 1')
  })

  it('не принимает чужой файл и не трогает журнал', () => {
    const onImport = vi.fn(() => ({ added: 0, skipped: 0 }))
    expect(describeImport('not json', onImport, true)).toBe('Файл не похож на журнал калькулятора.')
    expect(describeImport('{"hello":1}', onImport, false)).toBe('This file is not a calculator journal.')
    expect(onImport).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'

import { artilleryRegistry } from '../data/artillery/registry'
import type { BallisticProfile, BallisticRow } from '../types/artillery'
import { hasDragData, selectProfile } from './profileSelect'

// Строка без погодных поправок (5 столбцов) и с ними (12 столбцов)
const plain = [1000, 1300, 4.8, 0.7, 30.7] as unknown as BallisticRow
const weather = [1000, 1290, 4.9, 0.7, 30.9, 0.1, 2, -2, 1, -1, 1, -1] as unknown as BallisticRow

const make = (modes: BallisticProfile['modes']) => ({ columns: [], units: {}, modes }) as BallisticProfile

describe('selectProfile', () => {
  const noDrag = make({ HIGH: { 0: [plain] }, LOW: { 0: [plain] } })
  const drag = make({ LOW: { 0: [weather] } })
  const ammo = { profile: 'default', advancedProfile: 'advanced' }

  it('погодные поправки в таблице — значит, снята с сопротивлением воздуха', () => {
    expect(hasDragData(noDrag)).toBe(false)
    expect(hasDragData(drag)).toBe(true)
  })

  it('без улучшенной баллистики — таблицы без сопротивления', () => {
    const r = selectProfile({ profiles: { default: noDrag, advanced: drag } }, ammo, false)
    expect(r).toEqual({ profile: noDrag, substituted: [] })
  })

  it('с улучшенной баллистикой — таблицы с сопротивлением, недостающая траектория из других', () => {
    const r = selectProfile({ profiles: { default: noDrag, advanced: drag } }, ammo, true)
    expect(r.substituted).toEqual(['HIGH'])
    expect(r.profile?.modes.LOW).toBe(drag.modes.LOW)
    expect(r.profile?.modes.HIGH).toBe(noDrag.modes.HIGH)
    // Тот же объект при повторном вызове
    expect(selectProfile({ profiles: { default: noDrag, advanced: drag } }, ammo, true).profile).toBe(r.profile)
  })

  it('обычные таблицы с погодными поправками — это таблицы с сопротивлением', () => {
    const only = { profiles: { default: drag } }
    expect(selectProfile(only, { profile: 'default' }, true)).toEqual({ profile: drag, substituted: [] })
    // Без сопротивления своих таблиц нет: берутся эти же и предупреждение
    expect(selectProfile(only, { profile: 'default' }, false)).toEqual({ profile: drag, substituted: ['LOW'] })
  })

  it('таблиц с сопротивлением нет — обычные и предупреждение', () => {
    const r = selectProfile({ profiles: { default: noDrag } }, { profile: 'default' }, true)
    expect(r).toEqual({ profile: noDrag, substituted: ['HIGH', 'LOW'] })
  })

  it('нет профиля вообще — предупреждения нет', () => {
    expect(selectProfile({ profiles: {} }, undefined, true)).toEqual({ profile: undefined, substituted: [] })
  })

  it('M101: обе траектории без сопротивления, настильная и с ним', () => {
    const m101 = artilleryRegistry.m101
    const ammo101 = m101.ammunition?.[0]
    expect(selectProfile(m101, ammo101, false).substituted).toEqual([])
    expect(hasDragData(selectProfile(m101, ammo101, false).profile)).toBe(false)
    const advanced = selectProfile(m101, ammo101, true)
    expect(advanced.substituted).toEqual(['HIGH'])
    expect(hasDragData(advanced.profile)).toBe(true)
  })
})

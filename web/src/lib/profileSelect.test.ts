import { describe, expect, it } from 'vitest'

import type { BallisticProfile } from '../types/artillery'
import { selectProfile } from './profileSelect'

const make = (tag: string) => ({ columns: [], units: {}, modes: {}, tag }) as unknown as BallisticProfile

describe('selectProfile', () => {
  const normal = make('normal')
  const advanced = make('advanced')
  const ammo = { profile: 'default', advancedProfile: 'advanced' }

  it('без улучшенной баллистики — обычный профиль', () => {
    const r = selectProfile({ profiles: { default: normal, advanced } }, ammo, false)
    expect(r).toEqual({ profile: normal, missingAdvanced: false })
  })

  it('с улучшенной баллистикой — профиль advanced', () => {
    const r = selectProfile({ profiles: { default: normal, advanced } }, ammo, true)
    expect(r).toEqual({ profile: advanced, missingAdvanced: false })
  })

  it('таблиц advanced нет — обычный профиль и предупреждение', () => {
    const r = selectProfile({ profiles: { default: normal } }, { profile: 'default' }, true)
    expect(r).toEqual({ profile: normal, missingAdvanced: true })
  })

  it('нет профиля вообще — предупреждения нет', () => {
    expect(selectProfile({ profiles: {} }, undefined, true)).toEqual({
      profile: undefined,
      missingAdvanced: false,
    })
  })
})

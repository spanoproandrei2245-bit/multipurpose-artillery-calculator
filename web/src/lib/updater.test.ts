import { describe, expect, it } from 'vitest'

import { checkForUpdate } from './updater'

describe('checkForUpdate', () => {
  it('в браузере обновлений нет: проверяет только программа для ПК', async () => {
    expect(await checkForUpdate()).toBeNull()
  })
})

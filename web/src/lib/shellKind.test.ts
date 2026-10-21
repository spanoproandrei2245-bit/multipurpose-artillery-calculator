import { describe, expect, it } from 'vitest'

import { shellKind } from './shellKind'

describe('shellKind', () => {
  it('фугасный по умолчанию', () => {
    expect(shellKind('HE')).toBe('he')
    expect(shellKind('')).toBe('he')
    expect(shellKind('APERS')).toBe('he')
  })

  it('осветительный', () => {
    expect(shellKind('ILLUM')).toBe('illum')
    expect(shellKind('Flare')).toBe('illum')
    expect(shellKind('осветительный')).toBe('illum')
  })

  it('дымовой', () => {
    expect(shellKind('SMOKE')).toBe('smoke')
    expect(shellKind('WP')).toBe('smoke')
    expect(shellKind('дымовой')).toBe('smoke')
  })
})

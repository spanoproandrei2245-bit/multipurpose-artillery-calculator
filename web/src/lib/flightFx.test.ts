import { describe, expect, it } from 'vitest'

import type { ArtilleryCategory } from '../types/gameModel'
import { drawFlight, IMPACT_FX_SECONDS, type FlightParams } from './flightFx'
import type { ShellKind } from './shellKind'

/** Холст-заглушка: считает вызовы рисования. */
function fakeContext() {
  const calls: string[] = []
  const gradient = { addColorStop: () => {} }
  const target = {
    createRadialGradient: () => gradient,
    save: () => calls.push('save'),
  } as Record<string, unknown>
  return {
    calls,
    ctx: new Proxy(target, {
      get(obj, key: string) {
        if (key in obj) return obj[key]
        return () => {
          calls.push(key)
        }
      },
      set() {
        return true
      },
    }) as unknown as CanvasRenderingContext2D,
  }
}

const CATEGORIES: ArtilleryCategory[] = ['mortar', 'towed', 'spg', 'mlrs']
const KINDS: ShellKind[] = ['he', 'illum', 'smoke']

function params(over: Partial<FlightParams>): FlightParams {
  return {
    category: 'mortar',
    kind: 'he',
    ax: 10,
    ay: 80,
    bx: 300,
    by: 80,
    elapsed: 5,
    tof: 20,
    arc: 50,
    ...over,
  }
}

describe('drawFlight', () => {
  it('рисует полёт, разрыв и последствия для всех орудий, снарядов и стилей', () => {
    for (const style of ['minimal', 'detailed'] as const) {
      for (const category of CATEGORIES) {
        for (const kind of KINDS) {
          for (const elapsed of [0, 5, 19.9, 20, 20.3, 22, 23.9]) {
            const { ctx, calls } = fakeContext()
            expect(() =>
              drawFlight(ctx, params({ category, kind, style, elapsed }))
            ).not.toThrow()
            // Пока снаряд летит или только что разорвался — что-то нарисовано
            if (elapsed <= 20.3) expect(calls.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('ничего не рисует до выстрела и после конца эффектов', () => {
    const before = fakeContext()
    drawFlight(before.ctx, params({ elapsed: -1 }))
    expect(before.calls).toEqual([])

    const after = fakeContext()
    drawFlight(after.ctx, params({ elapsed: 20 + IMPACT_FX_SECONDS + 0.1 }))
    expect(after.calls).toEqual([])
  })

  it('нулевое время полёта не ломает расчёт', () => {
    const { ctx, calls } = fakeContext()
    drawFlight(ctx, params({ tof: 0 }))
    expect(calls).toEqual([])
  })
})

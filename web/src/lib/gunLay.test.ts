import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LAY_SETTINGS,
  INITIAL_LAY_STATE,
  MIN_CALIBRATION_COUNTS,
  layFraction,
  layGuidance,
  layReduce,
  parseLaySettings,
  type LayEvent,
  type LaySettings,
  type LayState,
} from './gunLay'

const settings: LaySettings = {
  milPerCount: 0.5,
  min: -100,
  max: 300,
  invert: false,
  tolerance: 1,
}

function run(events: LayEvent[], start: LayState = INITIAL_LAY_STATE, s = settings) {
  let current = { state: start, settings: s }
  for (const event of events) {
    current = layReduce(current.state, current.settings, event)
  }
  return current
}

describe('layReduce: движение мыши', () => {
  it('мышь вверх (dy < 0) поднимает ствол на milPerCount за отсчёт', () => {
    const { state } = run([{ type: 'move', dy: -40 }])
    expect(state.elevation).toBeCloseTo(20)
  })

  it('мышь вниз опускает ствол', () => {
    const { state } = run([{ type: 'move', dy: 10 }])
    expect(state.elevation).toBeCloseTo(-5)
  })

  it('invert меняет направление', () => {
    const { state } = run([{ type: 'move', dy: 10 }], INITIAL_LAY_STATE, {
      ...settings,
      invert: true,
    })
    expect(state.elevation).toBeCloseTo(5)
  })

  it('ствол упирается в пределы, как в игре', () => {
    expect(run([{ type: 'move', dy: -100000 }]).state.elevation).toBe(300)
    expect(run([{ type: 'move', dy: 100000 }]).state.elevation).toBe(-100)
  })

  it('после упора лишнее движение мыши не накапливается', () => {
    // Перебор вверх на 1000 отсчётов, потом 100 вниз: ствол в игре тоже
    // ушёл вниз ровно на 100 отсчётов от упора
    const { state } = run([
      { type: 'move', dy: -1000 },
      { type: 'move', dy: 100 },
    ])
    expect(state.elevation).toBeCloseTo(250)
  })
})

describe('layReduce: упоры', () => {
  it('нижний и верхний упор ставят угол в предел', () => {
    const start = { elevation: 42, calibration: null }
    expect(run([{ type: 'low' }], start).state.elevation).toBe(-100)
    expect(run([{ type: 'high' }], start).state.elevation).toBe(300)
  })
})

describe('layReduce: калибровка', () => {
  it('два нажатия выводят чувствительность из хода между упорами', () => {
    // 400 мил между упорами за 800 отсчётов: 0.5 мил на отсчёт
    const first = run([{ type: 'calibrate' }], { elevation: 50, calibration: null })
    expect(first.state).toEqual({ elevation: -100, calibration: 0 })

    const done = run(
      [{ type: 'move', dy: -800 }, { type: 'calibrate' }],
      first.state,
      { ...settings, milPerCount: 9 }
    )
    expect(done.settings.milPerCount).toBeCloseTo(0.5)
    expect(done.state).toEqual({ elevation: 300, calibration: null })
  })

  it('во время калибровки считаются только отсчёты вверх со знаком', () => {
    const { state } = run(
      [
        { type: 'calibrate' },
        { type: 'move', dy: -500 },
        { type: 'move', dy: 100 },
      ]
    )
    expect(state.calibration).toBe(400)
  })

  it('короткая калибровка отменяется без изменений', () => {
    const { state, settings: after } = run([
      { type: 'calibrate' },
      { type: 'move', dy: -(MIN_CALIBRATION_COUNTS - 1) },
      { type: 'calibrate' },
    ])
    expect(after.milPerCount).toBe(settings.milPerCount)
    expect(state.calibration).toBeNull()
  })

  it('упор отменяет калибровку', () => {
    const { state } = run([{ type: 'calibrate' }, { type: 'high' }])
    expect(state.calibration).toBeNull()
  })
})

describe('layGuidance', () => {
  it('в допуске: угол верный', () => {
    const g = layGuidance(100, 100.8, settings)
    expect(g.verdict).toBe('ok')
  })

  it('ниже цели: поднять, с числом отсчётов мыши', () => {
    const g = layGuidance(100, 120, settings)
    expect(g.verdict).toBe('raise')
    expect(g.error).toBeCloseTo(20)
    expect(g.counts).toBe(40)
  })

  it('выше цели: опустить', () => {
    const g = layGuidance(150, 120, settings)
    expect(g.verdict).toBe('lower')
    expect(g.counts).toBe(-60)
  })

  it('цель за упорами: недостижимо', () => {
    expect(layGuidance(0, 310, settings).verdict).toBe('unreachable')
    expect(layGuidance(0, -110, settings).verdict).toBe('unreachable')
  })
})

describe('layFraction', () => {
  it('0 на нижнем упоре, 1 на верхнем, значения за пределами обрезаются', () => {
    expect(layFraction(-100, settings)).toBe(0)
    expect(layFraction(300, settings)).toBe(1)
    expect(layFraction(100, settings)).toBeCloseTo(0.5)
    expect(layFraction(999, settings)).toBe(1)
  })
})

describe('parseLaySettings', () => {
  it('пусто и мусор дают стандартные настройки', () => {
    expect(parseLaySettings(null)).toEqual(DEFAULT_LAY_SETTINGS)
    expect(parseLaySettings('не json')).toEqual(DEFAULT_LAY_SETTINGS)
    expect(parseLaySettings('{"min":5,"max":1}')).toEqual(DEFAULT_LAY_SETTINGS)
  })

  it('читает сохранённые значения и чинит плохие поля', () => {
    const parsed = parseLaySettings(
      JSON.stringify({ milPerCount: -3, min: -50, max: 200, invert: true, tolerance: 2 })
    )
    expect(parsed).toEqual({
      milPerCount: DEFAULT_LAY_SETTINGS.milPerCount,
      min: -50,
      max: 200,
      invert: true,
      tolerance: 2,
    })
  })
})

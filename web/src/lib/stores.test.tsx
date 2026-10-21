// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setFlightOnMap, setFlightStyle, useFlightOnMap, useFlightStyle } from './animation'
import { setFeature, useFeature } from './features'
import { setPanel, tourDone, markTourDone, usePanel, togglePanel } from './uiPanels'

beforeEach(() => {
  localStorage.clear()
})
afterEach(cleanup)

describe('features', () => {
  it('разделы выключены, подсказки включены по умолчанию', () => {
    const { result } = renderHook(() => ({
      adjust: useFeature('adjust'),
      journal: useFeature('journal'),
      hints: useFeature('hints'),
    }))
    expect(result.current).toEqual({ adjust: false, journal: false, hints: true })
  })

  it('переключение видно всем подписчикам и сохраняется', () => {
    const a = renderHook(() => useFeature('weather'))
    const b = renderHook(() => useFeature('weather'))
    act(() => setFeature('weather', true))
    expect(a.result.current).toBe(true)
    expect(b.result.current).toBe(true)
    expect(localStorage.getItem('feature:weather')).toBe('on')
    act(() => setFeature('weather', false))
    expect(a.result.current).toBe(false)
  })

  it('подсказки можно выключить', () => {
    const { result } = renderHook(() => useFeature('hints'))
    act(() => setFeature('hints', false))
    expect(result.current).toBe(false)
    expect(localStorage.getItem('feature:hints')).toBe('off')
  })
})

describe('animation', () => {
  it('по умолчанию минимальная и на карте', () => {
    const { result } = renderHook(() => ({
      style: useFlightStyle(),
      onMap: useFlightOnMap(),
    }))
    expect(result.current).toEqual({ style: 'minimal', onMap: true })
  })

  it('вид и показ на карте переключаются и запоминаются', () => {
    const { result } = renderHook(() => ({
      style: useFlightStyle(),
      onMap: useFlightOnMap(),
    }))
    act(() => {
      setFlightStyle('detailed')
      setFlightOnMap(false)
    })
    expect(result.current).toEqual({ style: 'detailed', onMap: false })
    expect(localStorage.getItem('flightAnim')).toBe('detailed')
    expect(localStorage.getItem('flightAnimMap')).toBe('off')
    act(() => setFlightStyle('off'))
    expect(result.current.style).toBe('off')
  })
})

describe('uiPanels', () => {
  it('окна открываются, закрываются и переключаются', () => {
    const { result } = renderHook(() => usePanel('hotkeys'))
    expect(result.current).toBe(false)
    act(() => setPanel('hotkeys', true))
    expect(result.current).toBe(true)
    act(() => togglePanel('hotkeys'))
    expect(result.current).toBe(false)
  })

  it('обучение помнит, что его прошли', () => {
    expect(tourDone()).toBe(false)
    markTourDone()
    expect(tourDone()).toBe(true)
  })
})

describe('motion', () => {
  it('по умолчанию включена; выключение отмечается на <html> и запоминается', async () => {
    const { getMotion, setMotion, useMotion } = await import('./motion')
    const { result } = renderHook(() => useMotion())
    expect(result.current).toBe(true)
    act(() => setMotion(false))
    expect(result.current).toBe(false)
    expect(getMotion()).toBe(false)
    expect(document.documentElement.dataset.motion).toBe('off')
    expect(localStorage.getItem('uiMotion')).toBe('off')
    act(() => setMotion(true))
    expect(document.documentElement.dataset.motion).toBe('on')
  })
})

describe('timerSound', () => {
  it('звук включён по умолчанию и переключается', async () => {
    const { setTimerSound, useTimerSound } = await import('./timerSound')
    const { result } = renderHook(() => useTimerSound())
    expect(result.current).toBe(true)
    act(() => setTimerSound(false))
    expect(result.current).toBe(false)
    expect(localStorage.getItem('timerSound')).toBe('off')
    act(() => setTimerSound(true))
  })
})

describe('favorites', () => {
  it('добавляет и убирает, помнит между показами', async () => {
    const { useFavorites } = await import('./favorites')
    const first = renderHook(() => useFavorites('favTest'))
    act(() => first.result.current[1]('a'))
    act(() => first.result.current[1]('b'))
    expect(first.result.current[0]).toEqual(['a', 'b'])
    act(() => first.result.current[1]('a'))
    expect(first.result.current[0]).toEqual(['b'])
    const again = renderHook(() => useFavorites('favTest'))
    expect(again.result.current[0]).toEqual(['b'])
  })

  it('мусор в хранилище не ломает список', async () => {
    const { useFavorites } = await import('./favorites')
    localStorage.setItem('favBroken', '{not json')
    expect(renderHook(() => useFavorites('favBroken')).result.current[0]).toEqual([])
    localStorage.setItem('favMixed', JSON.stringify(['x', 5, null, 'y']))
    expect(renderHook(() => useFavorites('favMixed')).result.current[0]).toEqual(['x', 'y'])
  })
})

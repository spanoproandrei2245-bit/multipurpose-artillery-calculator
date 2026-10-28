// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setLanguage } from '../i18n'
import { DEFAULT_LAY_SETTINGS } from '../lib/gunLay'
import {
  getGunLay,
  layDispatch,
  setLayTarget,
  setLayTracking,
  updateLaySettings,
} from '../lib/gunLayStore'
import { LayReadout } from './GunLayPanel'

const settings = { ...DEFAULT_LAY_SETTINGS, min: -100, max: 300, milPerCount: 0.5 }

beforeEach(() => setLanguage('ru'))
afterEach(cleanup)

describe('LayReadout', () => {
  it('ниже нужного угла: подсказка поднять и число отсчётов мыши', () => {
    render(<LayReadout elevation={100} target={120} settings={settings} />)
    expect(screen.getByText('Поднять на 20 мил')).toBeTruthy()
    expect(screen.getByText('около 40 отсчётов мыши')).toBeTruthy()
  })

  it('выше нужного угла: подсказка опустить', () => {
    render(<LayReadout elevation={150} target={120} settings={settings} />)
    expect(screen.getByText('Опустить на 30 мил')).toBeTruthy()
  })

  it('в допуске: угол верный', () => {
    render(<LayReadout elevation={120} target={120.4} settings={settings} />)
    expect(screen.getByText('Угол верный')).toBeTruthy()
  })

  it('цель выше верхнего упора: недостижимо', () => {
    render(<LayReadout elevation={0} target={400} settings={settings} />)
    expect(screen.getByText('Угол вне пределов ствола')).toBeTruthy()
  })

  it('без нужного возвышения подсказывает, что ввести', () => {
    render(<LayReadout elevation={0} target={null} settings={settings} />)
    expect(screen.getByText(/Нет нужного возвышения/)).toBeTruthy()
  })
})

describe('хранилище наводки', () => {
  it('упор ставит угол, движение мыши двигает его, слежение и цель запоминаются', () => {
    updateLaySettings({ min: -100, max: 300, milPerCount: 0.5, invert: false })
    layDispatch({ type: 'low' })
    expect(getGunLay().state.elevation).toBe(-100)

    layDispatch({ type: 'move', dy: -200 })
    expect(getGunLay().state.elevation).toBeCloseTo(0)

    setLayTracking(true)
    setLayTarget(42)
    expect(getGunLay().tracking).toBe(true)
    expect(getGunLay().target).toBe(42)
    setLayTracking(false)
    setLayTarget(null)
  })
})

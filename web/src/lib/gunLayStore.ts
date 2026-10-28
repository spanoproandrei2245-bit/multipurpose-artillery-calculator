import { useSyncExternalStore } from 'react'

import {
  onHotkey,
  onMouseDelta,
  onSolutionRequest,
  publishLay,
  setMouseCapture,
} from './desktop'
import { getFeature } from './features'
import {
  INITIAL_LAY_STATE,
  layReduce,
  loadLayElevation,
  loadLaySettings,
  saveLayElevation,
  saveLaySettings,
  type LayEvent,
  type LaySettings,
  type LayState,
} from './gunLay'

/**
 * Состояние наводки по мыши живёт одно на программу: основное окно считает
 * угол, оверлей получает готовое событие `lay-state`. Хранилище не зависит
 * от того, открыта ли панель «Наводка по мыши».
 */
export interface LaySnapshot {
  // Движение мыши читается и меняет угол
  tracking: boolean
  state: LayState
  settings: LaySettings
  // Нужное возвышение, мил; null — нет
  target: number | null
}

// Не чаще: при 60 событиях мыши в секунду оверлею хватает 30 обновлений
const PUBLISH_INTERVAL_MS = 33

function initial(): LaySnapshot {
  const settings = loadLaySettings()
  return {
    tracking: false,
    state: { ...INITIAL_LAY_STATE, elevation: loadLayElevation(settings) },
    settings,
    target: null,
  }
}

let snapshot: LaySnapshot = initial()
const listeners = new Set<() => void>()
let publishTimer: number | null = null

function publishNow() {
  publishLay({
    tracking: snapshot.tracking,
    elevation: snapshot.state.elevation,
    target: snapshot.target,
    calibrating: snapshot.state.calibration !== null,
    settings: snapshot.settings,
  })
}

function schedulePublish() {
  if (publishTimer !== null) return
  publishTimer = window.setTimeout(() => {
    publishTimer = null
    publishNow()
    saveLayElevation(snapshot.state.elevation)
  }, PUBLISH_INTERVAL_MS)
}

function commit(next: LaySnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
  schedulePublish()
}

export function getGunLay(): LaySnapshot {
  return snapshot
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useGunLay(): LaySnapshot {
  return useSyncExternalStore(subscribe, getGunLay, getGunLay)
}

export function layDispatch(event: LayEvent) {
  const next = layReduce(snapshot.state, snapshot.settings, event)
  if (next.settings !== snapshot.settings) saveLaySettings(next.settings)
  commit({ ...snapshot, state: next.state, settings: next.settings })
}

export function setLayTracking(tracking: boolean) {
  if (tracking === snapshot.tracking) return
  setMouseCapture(tracking)
  commit({ ...snapshot, tracking })
}

export function setLayTarget(target: number | null) {
  if (target === snapshot.target) return
  commit({ ...snapshot, target })
}

export function updateLaySettings(patch: Partial<LaySettings>) {
  const settings = { ...snapshot.settings, ...patch }
  saveLaySettings(settings)
  commit({ ...snapshot, settings })
}

/**
 * Подписка на движение мыши и горячие клавиши. Только в основном окне
 * программы для ПК. Возвращает функцию отписки.
 */
export function startGunLay(): () => void {
  const stops = [
    onMouseDelta(({ dy }) => {
      if (snapshot.tracking) layDispatch({ type: 'move', dy })
    }),
    onHotkey((action) => {
      if (!getFeature('gunLay')) return
      if (action === 'lay') setLayTracking(!snapshot.tracking)
      else if (action === 'lay-low') layDispatch({ type: 'low' })
      else if (action === 'lay-high') layDispatch({ type: 'high' })
      else if (action === 'lay-calibrate') layDispatch({ type: 'calibrate' })
    }),
    // Оверлей открылся и просит текущее состояние
    onSolutionRequest(publishNow),
  ]
  return () => {
    stops.forEach((stop) => stop())
    // Окно закрывается: чтение мыши не должно остаться включённым
    setLayTracking(false)
  }
}

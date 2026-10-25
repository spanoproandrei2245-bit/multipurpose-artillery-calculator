import { useSyncExternalStore } from 'react'

/**
 * Окна, которые открываются из футера и по горячим клавишам:
 * справка по клавишам и обучение. Состояние общее для всего приложения.
 */
export type PanelId = 'hotkeys' | 'tour' | 'tourAdvanced' | 'help'

const open = new Set<PanelId>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  listeners.forEach((listener) => listener())
}

export function setPanel(id: PanelId, value: boolean) {
  if (value === open.has(id)) return
  if (value) open.add(id)
  else open.delete(id)
  emit()
}

export function togglePanel(id: PanelId) {
  setPanel(id, !open.has(id))
}

export function usePanel(id: PanelId): boolean {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
    () => 0
  )
  return open.has(id)
}

// ---- обучение: показывать ли при первом запуске ----

const TOUR_KEY = 'tourDone'

export function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'yes'
  } catch {
    return true
  }
}

export function markTourDone() {
  try {
    localStorage.setItem(TOUR_KEY, 'yes')
  } catch {
    // Хранилище недоступно — обучение покажется снова.
  }
}

const ADVANCED_KEY = 'tourAdvancedDone'

export function advancedTourDone(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === 'yes'
  } catch {
    return true
  }
}

export function markAdvancedTourDone() {
  try {
    localStorage.setItem(ADVANCED_KEY, 'yes')
  } catch {
    // Хранилище недоступно — предложение покажется снова.
  }
}

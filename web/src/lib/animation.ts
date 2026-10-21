import { useSyncExternalStore } from 'react'

/**
 * Настройки анимации выстрела: вид (выкл / минимальная / подробная)
 * и показывать ли её на карте. Общее состояние в localStorage.
 */
export type FlightStyle = 'off' | 'minimal' | 'detailed'

const STYLES: readonly FlightStyle[] = ['off', 'minimal', 'detailed']
const listeners = new Set<() => void>()
const memory: { style?: FlightStyle; map?: boolean } = {}

function readStyle(): FlightStyle {
  try {
    const v = localStorage.getItem('flightAnim')
    return STYLES.find((s) => s === v) ?? 'minimal'
  } catch {
    return 'minimal'
  }
}

function readMap(): boolean {
  try {
    return localStorage.getItem('flightAnimMap') !== 'off'
  } catch {
    return true
  }
}

function emit() {
  listeners.forEach((l) => l())
}

export function setFlightStyle(style: FlightStyle) {
  memory.style = style
  try {
    localStorage.setItem('flightAnim', style)
  } catch {
    // Хранилище недоступно — настройка живёт до перезагрузки.
  }
  emit()
}

export function setFlightOnMap(value: boolean) {
  memory.map = value
  try {
    localStorage.setItem('flightAnimMap', value ? 'on' : 'off')
  } catch {
    // см. выше
  }
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useFlightStyle(): FlightStyle {
  return useSyncExternalStore(subscribe, () => memory.style ?? readStyle(), () => 'minimal')
}

export function useFlightOnMap(): boolean {
  return useSyncExternalStore(subscribe, () => memory.map ?? readMap(), () => true)
}

import { useSyncExternalStore } from 'react'

/** Звуковые сигналы таймера (щелчок, сплэш, разрыв): включаются в настройках. */
const KEY = 'timerSound'
const listeners = new Set<() => void>()
let memory: boolean | undefined

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function getTimerSound(): boolean {
  return memory ?? read()
}

export function setTimerSound(value: boolean) {
  memory = value
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off')
  } catch {
    // Хранилище недоступно — настройка живёт до перезагрузки.
  }
  listeners.forEach((listener) => listener())
}

export function useTimerSound(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getTimerSound,
    () => true
  )
}

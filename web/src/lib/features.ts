import { useSyncExternalStore } from 'react'

/**
 * Необязательные разделы калькулятора: включаются в настройках.
 * По умолчанию выключены, чтобы главный экран не был перегружен.
 */
export type FeatureId =
  | 'adjust'
  | 'weather'
  | 'tot'
  | 'journal'
  | 'table'
  // Не раздел, а подсказки: подсказки при наведении и пояснительные плашки
  | 'hints'

const KEY_PREFIX = 'feature:'
const listeners = new Set<() => void>()

function read(id: FeatureId): boolean {
  try {
    const value = localStorage.getItem(KEY_PREFIX + id)
    // Подсказки включены, пока их не выключили
    return id === 'hints' ? value !== 'off' : value === 'on'
  } catch {
    return id === 'hints'
  }
}

const memory = new Map<FeatureId, boolean>()

export function setFeature(id: FeatureId, value: boolean) {
  memory.set(id, value)
  try {
    localStorage.setItem(KEY_PREFIX + id, value ? 'on' : 'off')
  } catch {
    // Хранилище недоступно — настройка живёт до перезагрузки.
  }
  listeners.forEach((listener) => listener())
}

function snapshot(id: FeatureId): boolean {
  return memory.get(id) ?? read(id)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Включён ли необязательный раздел. */
export function useFeature(id: FeatureId): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(id),
    () => id === 'hints'
  )
}

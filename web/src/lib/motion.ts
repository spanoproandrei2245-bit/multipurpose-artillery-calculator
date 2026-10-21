import { useSyncExternalStore } from 'react'

/**
 * Анимации интерфейса: плавные переходы, появление окон, скользящие
 * переключатели, «прокрутка» чисел, круг при смене темы, переезд обучения.
 * По умолчанию включены, если в системе не выбрано «уменьшить движение».
 * Выключение гасит все CSS-анимации разом (data-motion="off" на <html>).
 */
const KEY = 'uiMotion'
const listeners = new Set<() => void>()
let memory: boolean | undefined

function systemReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function read(): boolean {
  try {
    const value = localStorage.getItem(KEY)
    if (value === 'on') return true
    if (value === 'off') return false
  } catch {
    // Хранилище недоступно — берём системную настройку
  }
  return !systemReduced()
}

export function getMotion(): boolean {
  return memory ?? read()
}

/** Отметить выбор на <html>: CSS по нему отключает анимации. */
export function applyMotion() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.motion = getMotion() ? 'on' : 'off'
}

export function setMotion(value: boolean) {
  memory = value
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off')
  } catch {
    // Настройка живёт до перезагрузки.
  }
  applyMotion()
  listeners.forEach((listener) => listener())
}

export function useMotion(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getMotion,
    () => true
  )
}
